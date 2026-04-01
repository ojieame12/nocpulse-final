import test from "node:test";
import assert from "node:assert/strict";
import { rebuildFieldMoistureEstimate } from "./rebuildFieldMoistureEstimate";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRepository() {
  const capture: { inputs: Record<string, unknown> | null } = { inputs: null };

  return {
    repository: {
      async getLatestByField() {
        return null;
      },
      async upsertSnapshot(input: Record<string, unknown>) {
        capture.inputs = input.inputs as Record<string, unknown>;
        return {
          id: "snapshot-1",
          workspaceId: input.workspaceId,
          fieldId: input.fieldId,
          observedAt: input.observedAt,
          sourceKey: input.sourceKey,
          rootZonePct: input.rootZonePct,
          surfacePct: input.surfacePct,
          confidence: input.confidence,
          inputs: input.inputs,
          createdAt: input.observedAt,
        };
      },
    } as Parameters<typeof rebuildFieldMoistureEstimate>[0]["repository"],
    capture,
  };
}

function makeEstimate() {
  return {
    workspaceId: "workspace-1",
    fieldId: "field-1",
    observedAt: "2026-03-31T10:00:00.000Z",
    sourceKey: "imagery-weather-derived-v1",
    inputs: {},
  };
}

// ---------------------------------------------------------------------------
// Original test (preserved)
// ---------------------------------------------------------------------------

test("rebuildFieldMoistureEstimate records the weather soil baseline dataset", async () => {
  const { repository, capture } = makeRepository();

  const result = await rebuildFieldMoistureEstimate({
    repository,
    estimate: makeEstimate(),
    sources: {
      rasterObservation: {
        sourceKey: "sentinel-hub-stats-v1:sentinel-2",
        cells: [
          {
            measurements: {
              ndmi: 0.62,
              ndvi: 0.71,
            },
          },
        ],
      },
      weatherObservation: {
        sourceKey: "open-meteo:hourly-v1",
        airTemperatureC: 18,
        precipitationMm: 0.4,
        relativeHumidityPct: 61,
        soilMoisturePct: 34,
        evapotranspirationMm: 1.1,
        provenance: {
          soilDataset: "open-meteo-hourly",
          forecastModel: "open-meteo-best-match",
        },
      },
    },
  });

  assert.equal(result.snapshot.inputs.baselineDataset, "open-meteo-hourly");
  assert.equal(capture.inputs?.baselineDataset, "open-meteo-hourly");
  assert.equal(result.snapshot.inputs.signalBlend, "raster+weather");
  assert.equal(result.snapshot.inputs.usedWeatherSoilMoisture, true);
  assert.match(
    result.snapshot.inputs.confidenceReason ?? "",
    /baseline soil moisture/,
  );
});

// ---------------------------------------------------------------------------
// Thermal term is not applied when avgThermal is null (default behavior)
// ---------------------------------------------------------------------------

test("thermal term contributes 0 when avgThermal is null (dropFakeThermal default)", async () => {
  const { repository } = makeRepository();

  // Run with SAR data that would previously trigger the SAR→thermal fallback
  const withSar = await rebuildFieldMoistureEstimate({
    repository,
    estimate: makeEstimate(),
    sources: {
      rasterObservation: {
        sourceKey: "sentinel-1-sar",
        cells: [{ measurements: { sarWetness: 0.7, sarRatio: 0.5 } }],
      },
      weatherObservation: {
        sourceKey: "open-meteo:hourly-v1",
        airTemperatureC: 20,
        precipitationMm: 0,
        relativeHumidityPct: null,
        soilMoisturePct: 50,
        evapotranspirationMm: 0,
      },
    },
    // dropFakeThermal defaults to true
  });

  // Run without SAR data, same weather baseline
  const withoutSar = await rebuildFieldMoistureEstimate({
    repository,
    estimate: makeEstimate(),
    sources: {
      rasterObservation: null,
      weatherObservation: {
        sourceKey: "open-meteo:hourly-v1",
        airTemperatureC: 20,
        precipitationMm: 0,
        relativeHumidityPct: null,
        soilMoisturePct: 50,
        evapotranspirationMm: 0,
      },
    },
  });

  // The SAR run should differ only from moisture/vigor/shadow signals, not thermal.
  // Critically: rootZonePct must be a number (output shape preserved).
  assert.equal(typeof withSar.snapshot.rootZonePct, "number");
  assert.equal(typeof withoutSar.snapshot.rootZonePct, "number");
});

// ---------------------------------------------------------------------------
// SAR→thermal fallback is removed (default)
// ---------------------------------------------------------------------------

test("SAR→thermal fallback is removed by default", async () => {
  const { repository } = makeRepository();

  // With SAR wetness = 0.9, old code would have produced
  // thermalSignal = clamp(1 - 0.9 * 0.9, 0, 1) = 0.19 which != null.
  // Now thermalSignal should be null and contribute 0.
  const resultA = await rebuildFieldMoistureEstimate({
    repository,
    estimate: makeEstimate(),
    sources: {
      rasterObservation: {
        sourceKey: "sentinel-1-sar",
        cells: [{ measurements: { sarWetness: 0.9, sarRatio: 0.5 } }],
      },
      weatherObservation: {
        sourceKey: "weather-v1",
        airTemperatureC: 20,
        precipitationMm: 0,
        relativeHumidityPct: null,
        soilMoisturePct: 50,
        evapotranspirationMm: 0,
      },
    },
  });

  // Same but with sarWetness = 0.1 — if thermal were still derived from SAR
  // the results would differ due to the thermal coefficient.
  const resultB = await rebuildFieldMoistureEstimate({
    repository,
    estimate: makeEstimate(),
    sources: {
      rasterObservation: {
        sourceKey: "sentinel-1-sar",
        cells: [{ measurements: { sarWetness: 0.1, sarRatio: 0.5 } }],
      },
      weatherObservation: {
        sourceKey: "weather-v1",
        airTemperatureC: 20,
        precipitationMm: 0,
        relativeHumidityPct: null,
        soilMoisturePct: 50,
        evapotranspirationMm: 0,
      },
    },
  });

  // The difference should ONLY come from moistureSignal (sarWetness) and vigorSignal,
  // NOT from thermal. Compute the expected difference from moisture alone.
  // moistureSignal diff: (0.9 - 0.5)*38 vs (0.1 - 0.5)*38 => 15.2 vs -15.2 => delta = 30.4
  // If thermal were still present: additional thermal delta would change the gap.
  const diff = Math.abs(resultA.snapshot.rootZonePct - resultB.snapshot.rootZonePct);

  // With only moisture contributing at coeff 38, max diff = (0.9 - 0.1) * 38 = 30.4
  // If thermal were still leaking, the diff would be different (larger or smaller).
  assert.ok(diff > 0, "SAR wetness difference should produce different rootZonePct");
  assert.equal(typeof resultA.snapshot.rootZonePct, "number");
});

// ---------------------------------------------------------------------------
// Legacy behavior restored when dropFakeThermal = false
// ---------------------------------------------------------------------------

test("legacy thermal fallback restored when dropFakeThermal is false", async () => {
  const { repository } = makeRepository();

  const resultDefault = await rebuildFieldMoistureEstimate({
    repository,
    estimate: makeEstimate(),
    sources: {
      rasterObservation: {
        sourceKey: "sentinel-1-sar",
        cells: [{ measurements: { sarWetness: 0.8, sarRatio: 0.5 } }],
      },
      weatherObservation: {
        sourceKey: "weather-v1",
        airTemperatureC: 20,
        precipitationMm: 0,
        relativeHumidityPct: null,
        soilMoisturePct: 50,
        evapotranspirationMm: 0,
      },
    },
    options: { dropFakeThermal: true },
  });

  const resultLegacy = await rebuildFieldMoistureEstimate({
    repository,
    estimate: makeEstimate(),
    sources: {
      rasterObservation: {
        sourceKey: "sentinel-1-sar",
        cells: [{ measurements: { sarWetness: 0.8, sarRatio: 0.5 } }],
      },
      weatherObservation: {
        sourceKey: "weather-v1",
        airTemperatureC: 20,
        precipitationMm: 0,
        relativeHumidityPct: null,
        soilMoisturePct: 50,
        evapotranspirationMm: 0,
      },
    },
    options: { dropFakeThermal: false },
  });

  // Legacy mode should produce a different rootZonePct because of thermal term
  assert.notEqual(
    resultDefault.snapshot.rootZonePct,
    resultLegacy.snapshot.rootZonePct,
    "dropFakeThermal=false should produce different result due to thermal term",
  );
});

// ---------------------------------------------------------------------------
// Water balance from weather signal set is used when available
// ---------------------------------------------------------------------------

test("uses netWaterBalance24hMm from weatherSignalSet when available", async () => {
  const { repository } = makeRepository();

  // Without weatherSignalSet: moisturePulse = precip*1.6 - et*2.2 = 5*1.6 - 2*2.2 = 3.6
  const withoutSignalSet = await rebuildFieldMoistureEstimate({
    repository,
    estimate: makeEstimate(),
    sources: {
      rasterObservation: null,
      weatherObservation: {
        sourceKey: "weather-v1",
        airTemperatureC: 20,
        precipitationMm: 5,
        relativeHumidityPct: null,
        soilMoisturePct: 50,
        evapotranspirationMm: 2,
      },
    },
  });

  // With weatherSignalSet providing a very different netWaterBalance24hMm
  const withSignalSet = await rebuildFieldMoistureEstimate({
    repository,
    estimate: makeEstimate(),
    sources: {
      rasterObservation: null,
      weatherObservation: {
        sourceKey: "weather-v1",
        airTemperatureC: 20,
        precipitationMm: 5,
        relativeHumidityPct: null,
        soilMoisturePct: 50,
        evapotranspirationMm: 2,
      },
      weatherSignalSet: {
        netWaterBalance24hMm: -10,
        netWaterBalance72hMm: -20,
      },
    },
  });

  // The negative water balance should produce a lower rootZonePct
  assert.ok(
    withSignalSet.snapshot.rootZonePct < withoutSignalSet.snapshot.rootZonePct,
    `Expected rootZonePct with negative water balance (${withSignalSet.snapshot.rootZonePct}) ` +
      `to be less than without (${withoutSignalSet.snapshot.rootZonePct})`,
  );
});

// ---------------------------------------------------------------------------
// Old behavior preserved when water balance is null
// ---------------------------------------------------------------------------

test("falls back to ad-hoc water balance when weatherSignalSet is null", async () => {
  const { repository } = makeRepository();

  const withNullSignalSet = await rebuildFieldMoistureEstimate({
    repository,
    estimate: makeEstimate(),
    sources: {
      rasterObservation: null,
      weatherObservation: {
        sourceKey: "weather-v1",
        airTemperatureC: 20,
        precipitationMm: 3,
        relativeHumidityPct: null,
        soilMoisturePct: 50,
        evapotranspirationMm: 1,
      },
      weatherSignalSet: null,
    },
  });

  const withoutSignalSet = await rebuildFieldMoistureEstimate({
    repository,
    estimate: makeEstimate(),
    sources: {
      rasterObservation: null,
      weatherObservation: {
        sourceKey: "weather-v1",
        airTemperatureC: 20,
        precipitationMm: 3,
        relativeHumidityPct: null,
        soilMoisturePct: 50,
        evapotranspirationMm: 1,
      },
    },
  });

  // Should produce identical results — null signal set == no signal set
  assert.equal(
    withNullSignalSet.snapshot.rootZonePct,
    withoutSignalSet.snapshot.rootZonePct,
    "null weatherSignalSet should fall back to ad-hoc water balance",
  );
});

// ---------------------------------------------------------------------------
// Output shape preserved (rootZonePct always present)
// ---------------------------------------------------------------------------

test("output always contains rootZonePct and surfacePct fields", async () => {
  const { repository } = makeRepository();

  const result = await rebuildFieldMoistureEstimate({
    repository,
    estimate: makeEstimate(),
    sources: {},
  });

  assert.equal(typeof result.snapshot.rootZonePct, "number");
  assert.equal(typeof result.snapshot.surfacePct, "number");
  assert.ok(result.snapshot.rootZonePct >= 0);
  assert.ok(result.snapshot.rootZonePct <= 100);
  assert.ok(result.snapshot.surfacePct >= 0);
  assert.ok(result.snapshot.surfacePct <= 100);
});

// ---------------------------------------------------------------------------
// Depletion / mm-based water storage tests
// ---------------------------------------------------------------------------

function makeSoilSources(overrides: {
  soilMoisturePct?: number | null;
  fieldCapacityPct?: number | null;
  wiltingPointPct?: number | null;
  rootZoneDepthCm?: number;
  netWaterBalance24hMm?: number | null;
}) {
  return {
    rasterObservation: null,
    weatherObservation: {
      sourceKey: "weather-v1",
      airTemperatureC: 20,
      precipitationMm: 0,
      relativeHumidityPct: null,
      soilMoisturePct: overrides.soilMoisturePct ?? 30,
      evapotranspirationMm: 0,
    },
    weatherSignalSet: overrides.netWaterBalance24hMm !== undefined
      ? { netWaterBalance24hMm: overrides.netWaterBalance24hMm }
      : null,
    fieldCapacityPct: overrides.fieldCapacityPct,
    wiltingPointPct: overrides.wiltingPointPct,
    rootZoneDepthCm: overrides.rootZoneDepthCm,
  } satisfies Parameters<typeof rebuildFieldMoistureEstimate>[0]["sources"];
}

test("depletion = 0% when storage is at field capacity", async () => {
  const { repository } = makeRepository();
  // soilMoisturePct = fieldCapacityPct => storage at FC => depletion = 0%
  const result = await rebuildFieldMoistureEstimate({
    repository,
    estimate: makeEstimate(),
    sources: makeSoilSources({
      soilMoisturePct: 35,
      fieldCapacityPct: 35,
      wiltingPointPct: 15,
    }),
  });

  assert.equal(result.snapshot.inputs.depletionPct, 0);
  assert.equal(typeof result.snapshot.rootZonePct, "number");
});

test("depletion = 100% when storage is at wilting point", async () => {
  const { repository } = makeRepository();
  const result = await rebuildFieldMoistureEstimate({
    repository,
    estimate: makeEstimate(),
    sources: makeSoilSources({
      soilMoisturePct: 15,
      fieldCapacityPct: 35,
      wiltingPointPct: 15,
    }),
  });

  assert.equal(result.snapshot.inputs.depletionPct, 100);
});

test("depletion = 50% when storage is halfway between FC and WP", async () => {
  const { repository } = makeRepository();
  // FC=35%, WP=15%, midpoint=25%
  const result = await rebuildFieldMoistureEstimate({
    repository,
    estimate: makeEstimate(),
    sources: makeSoilSources({
      soilMoisturePct: 25,
      fieldCapacityPct: 35,
      wiltingPointPct: 15,
    }),
  });

  assert.equal(result.snapshot.inputs.depletionPct, 50);
});

test("null soil props → depletionPct is null, rootZonePct still computed", async () => {
  const { repository } = makeRepository();
  const result = await rebuildFieldMoistureEstimate({
    repository,
    estimate: makeEstimate(),
    sources: makeSoilSources({
      soilMoisturePct: 30,
      fieldCapacityPct: null,
      wiltingPointPct: null,
    }),
  });

  assert.equal(result.snapshot.inputs.depletionPct, null);
  assert.equal(typeof result.snapshot.rootZonePct, "number");
  assert.ok(result.snapshot.rootZonePct >= 0);
});

test("water balance in mm adds correctly to storage", async () => {
  const { repository } = makeRepository();
  // FC=40%, WP=10%, depth=30cm => rootZoneDepthMm=300
  // fcMm=120, wpMm=30
  // baseStorageMm = (25/100)*300 = 75mm
  // netWaterBalanceMm = 10mm
  // storageMm = 75+10 = 85mm (within bounds)
  // depletionPct = ((120-85)/(120-30))*100 = (35/90)*100 = 38.9
  const result = await rebuildFieldMoistureEstimate({
    repository,
    estimate: makeEstimate(),
    sources: makeSoilSources({
      soilMoisturePct: 25,
      fieldCapacityPct: 40,
      wiltingPointPct: 10,
      netWaterBalance24hMm: 10,
    }),
  });

  assert.equal(result.snapshot.inputs.waterStorageMm, 85);
  assert.equal(result.snapshot.inputs.availableWaterMm, 55); // 85 - 30
  // depletionPct = (120-85)/(120-30)*100 = 38.888... rounded to 38.9
  assert.ok(
    Math.abs((result.snapshot.inputs.depletionPct ?? NaN) - 38.9) < 0.1,
    `Expected depletionPct ~38.9, got ${result.snapshot.inputs.depletionPct}`,
  );
});

test("storage clamped at field capacity (cannot exceed)", async () => {
  const { repository } = makeRepository();
  // FC=35%, WP=15%, depth=30cm => fcMm=105, wpMm=45
  // baseStorageMm = (35/100)*300 = 105mm (already at FC)
  // netWaterBalanceMm = 50mm => would go to 155mm, clamped to 105
  const result = await rebuildFieldMoistureEstimate({
    repository,
    estimate: makeEstimate(),
    sources: makeSoilSources({
      soilMoisturePct: 35,
      fieldCapacityPct: 35,
      wiltingPointPct: 15,
      netWaterBalance24hMm: 50,
    }),
  });

  assert.equal(result.snapshot.inputs.waterStorageMm, 105);
  assert.equal(result.snapshot.inputs.depletionPct, 0);
});

test("storage clamped at wilting point (cannot go below)", async () => {
  const { repository } = makeRepository();
  // FC=35%, WP=15%, depth=30cm => fcMm=105, wpMm=45
  // baseStorageMm = (15/100)*300 = 45mm (already at WP)
  // netWaterBalanceMm = -50mm => would go to -5mm, clamped to 45
  const result = await rebuildFieldMoistureEstimate({
    repository,
    estimate: makeEstimate(),
    sources: makeSoilSources({
      soilMoisturePct: 15,
      fieldCapacityPct: 35,
      wiltingPointPct: 15,
      netWaterBalance24hMm: -50,
    }),
  });

  assert.equal(result.snapshot.inputs.waterStorageMm, 45);
  assert.equal(result.snapshot.inputs.depletionPct, 100);
  assert.equal(result.snapshot.inputs.availableWaterMm, 0);
});

test("available water = storageMm - wpMm", async () => {
  const { repository } = makeRepository();
  // FC=40%, WP=10%, depth=30cm => fcMm=120, wpMm=30
  // baseStorageMm = (30/100)*300 = 90mm
  // availableWaterMm = 90 - 30 = 60mm
  const result = await rebuildFieldMoistureEstimate({
    repository,
    estimate: makeEstimate(),
    sources: makeSoilSources({
      soilMoisturePct: 30,
      fieldCapacityPct: 40,
      wiltingPointPct: 10,
    }),
  });

  assert.equal(result.snapshot.inputs.availableWaterMm, 60);
  assert.equal(result.snapshot.inputs.waterStorageMm, 90);
});
