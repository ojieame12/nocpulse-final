import test from "node:test";
import assert from "node:assert/strict";
import {
  computeRasterAgeHours,
  computeFreshnessFactor,
  resolveResolutionTier,
  computeScaleFitPenalty,
  computeAgreement,
} from "./rebuildFieldMoistureEstimate";
import { rebuildFieldMoistureEstimate } from "./rebuildFieldMoistureEstimate";
import type { FieldMoistureSnapshot } from "../contracts/FieldMoistureSnapshot";

// ---------------------------------------------------------------------------
// Helper: stub repository that captures the upserted snapshot
// ---------------------------------------------------------------------------

function stubRepository() {
  let captured: FieldMoistureSnapshot | null = null;
  return {
    repo: {
      async getLatestByField() {
        return null;
      },
      async upsertSnapshot(input: Record<string, unknown>) {
        const snapshot = {
          id: "snapshot-1",
          ...input,
          createdAt: input.observedAt,
        } as unknown as FieldMoistureSnapshot;
        captured = snapshot;
        return snapshot;
      },
    },
    get captured() {
      return captured;
    },
  };
}

const baseEstimate = {
  workspaceId: "workspace-1",
  fieldId: "field-1",
  observedAt: "2026-03-31T12:00:00.000Z",
  sourceKey: "imagery-weather-derived-v1",
  inputs: {},
};

// ===========================================================================
// 1. Freshness-weighted confidence
// ===========================================================================

test("computeRasterAgeHours: fresh raster (2h old)", () => {
  const age = computeRasterAgeHours(
    "2026-03-31T10:00:00.000Z",
    "2026-03-31T12:00:00.000Z",
  );
  assert.equal(age, 2);
});

test("computeRasterAgeHours: null when no observedAt", () => {
  assert.equal(computeRasterAgeHours(null, "2026-03-31T12:00:00.000Z"), null);
  assert.equal(computeRasterAgeHours(undefined, "2026-03-31T12:00:00.000Z"), null);
});

test("computeFreshnessFactor: fresh raster gets full factor", () => {
  const factor = computeFreshnessFactor(2);
  // 1 - 2/360 = 0.9944...
  assert.ok(factor > 0.99);
  assert.ok(factor <= 1);
});

test("computeFreshnessFactor: 15-day-old raster gets 0", () => {
  const factor = computeFreshnessFactor(360);
  assert.equal(factor, 0);
});

test("computeFreshnessFactor: older than 15 days still 0 (clamped)", () => {
  const factor = computeFreshnessFactor(500);
  assert.equal(factor, 0);
});

test("computeFreshnessFactor: null age returns 1 (backward compat)", () => {
  assert.equal(computeFreshnessFactor(null), 1);
});

test("computeFreshnessFactor: half-life at 180h", () => {
  const factor = computeFreshnessFactor(180);
  assert.ok(Math.abs(factor - 0.5) < 0.001);
});

test("fresh raster (2h) gets nearly full baseScore in integration", async () => {
  const { repo } = stubRepository();
  const result = await rebuildFieldMoistureEstimate({
    repository: repo,
    estimate: baseEstimate,
    sources: {
      estimateTimestamp: "2026-03-31T12:00:00.000Z",
      rasterObservation: {
        sourceKey: "sentinel-hub-stats-v1:sentinel-2",
        observedAt: "2026-03-31T10:00:00.000Z",
        cells: [{ measurements: { ndmi: 0.5, ndvi: 0.5 } }],
      },
    },
  });
  const prov = result.snapshot.inputs;
  assert.ok(prov.freshnessFactor! > 0.99);
  assert.ok(prov.rasterAgeHours! < 3);
  // confidence should be meaningful (raster alone with full freshness ~ 0.45)
  assert.ok(prov.confidenceScore! >= 0.4);
});

test("15-day-old raster gets 0 raster contribution", async () => {
  const { repo } = stubRepository();
  const result = await rebuildFieldMoistureEstimate({
    repository: repo,
    estimate: baseEstimate,
    sources: {
      estimateTimestamp: "2026-04-15T12:00:00.000Z",
      rasterObservation: {
        sourceKey: "sentinel-hub-stats-v1:sentinel-2",
        observedAt: "2026-03-31T12:00:00.000Z",
        cells: [{ measurements: { ndmi: 0.5 } }],
      },
    },
  });
  const prov = result.snapshot.inputs;
  assert.equal(prov.freshnessFactor, 0);
  // With freshness 0, raster contributes 0 to confidence
  assert.ok(prov.confidenceScore! < 0.01);
});

// ===========================================================================
// 2. Multi-source agreement
// ===========================================================================

test("computeAgreement: delta < 5% -> agree bonus +0.10", () => {
  const result = computeAgreement(34, 36);
  assert.ok(result !== null);
  assert.equal(result.flag, "agree");
  assert.equal(result.bonus, 0.10);
  assert.ok(result.deltaPct < 5);
});

test("computeAgreement: delta 5-15% -> neutral", () => {
  const result = computeAgreement(30, 40);
  assert.ok(result !== null);
  assert.equal(result.flag, "neutral");
  assert.equal(result.bonus, 0);
});

test("computeAgreement: delta > 15% -> divergent penalty -0.05", () => {
  const result = computeAgreement(20, 50);
  assert.ok(result !== null);
  assert.equal(result.flag, "divergent");
  assert.equal(result.bonus, -0.05);
  assert.ok(result.deltaPct > 15);
});

test("computeAgreement: null when either input is null", () => {
  assert.equal(computeAgreement(null, 34), null);
  assert.equal(computeAgreement(34, null), null);
  assert.equal(computeAgreement(null, null), null);
});

test("agreement bonus in integration: raster+weather close signals", async () => {
  const { repo } = stubRepository();
  // ndmi 0.35 -> rasterSignalToPct = 20 + 0.35*40 = 34
  // weather soilMoisturePct = 35 -> delta = 1 -> agree
  const result = await rebuildFieldMoistureEstimate({
    repository: repo,
    estimate: baseEstimate,
    sources: {
      estimateTimestamp: "2026-03-31T12:00:00.000Z",
      rasterObservation: {
        sourceKey: "sentinel-hub-stats-v1:sentinel-2",
        observedAt: "2026-03-31T11:00:00.000Z",
        cells: [{ measurements: { ndmi: 0.35 } }],
      },
      weatherObservation: {
        sourceKey: "open-meteo:hourly-v1",
        airTemperatureC: 20,
        precipitationMm: 0,
        relativeHumidityPct: null,
        soilMoisturePct: 35,
        evapotranspirationMm: 0,
      },
    },
  });
  const prov = result.snapshot.inputs;
  assert.equal(prov.agreementFlag, "agree");
  assert.ok(prov.agreementDeltaPct! < 5);
  assert.ok(prov.confidenceReason!.includes("signals-agree"));
});

test("divergent flag in integration: raster+weather far apart", async () => {
  const { repo } = stubRepository();
  // ndmi 0.0 -> rasterSignalToPct = 20 + 0*40 = 20
  // weather soilMoisturePct = 60 -> delta = 40 -> divergent
  const result = await rebuildFieldMoistureEstimate({
    repository: repo,
    estimate: baseEstimate,
    sources: {
      estimateTimestamp: "2026-03-31T12:00:00.000Z",
      rasterObservation: {
        sourceKey: "sentinel-hub-stats-v1:sentinel-2",
        observedAt: "2026-03-31T11:00:00.000Z",
        cells: [{ measurements: { ndmi: 0.0 } }],
      },
      weatherObservation: {
        sourceKey: "open-meteo:hourly-v1",
        airTemperatureC: 20,
        precipitationMm: 0,
        relativeHumidityPct: null,
        soilMoisturePct: 60,
        evapotranspirationMm: 0,
      },
    },
  });
  const prov = result.snapshot.inputs;
  assert.equal(prov.agreementFlag, "divergent");
  assert.ok(prov.agreementDeltaPct! > 15);
  assert.ok(prov.confidenceReason!.includes("signals-divergent"));
});

// ===========================================================================
// 3. Resolution tier identification
// ===========================================================================

test("resolveResolutionTier: Sentinel-2 -> sub-field", () => {
  const { tier, resolutionM } = resolveResolutionTier("sentinel-hub-stats-v1:sentinel-2", null);
  assert.equal(tier, "sub-field");
  assert.equal(resolutionM, 15);
});

test("resolveResolutionTier: Sentinel-1 -> sub-field", () => {
  const { tier } = resolveResolutionTier("sentinel-1-sar", null);
  assert.equal(tier, "sub-field");
});

test("resolveResolutionTier: SoilGrids -> field-level", () => {
  const { tier, resolutionM } = resolveResolutionTier("soilgrids-v2", null);
  assert.equal(tier, "field-level");
  assert.equal(resolutionM, 250);
});

test("resolveResolutionTier: Open-Meteo weather only -> regional", () => {
  const { tier, resolutionM } = resolveResolutionTier(null, "open-meteo:hourly-v1");
  assert.equal(tier, "regional");
  assert.equal(resolutionM, 9000);
});

test("resolveResolutionTier: ERA5-Land weather only -> regional", () => {
  const { tier } = resolveResolutionTier(null, "era5-land-v1");
  assert.equal(tier, "regional");
});

test("resolveResolutionTier: unknown raster source -> field-level fallback", () => {
  const { tier } = resolveResolutionTier("some-custom-raster", null);
  assert.equal(tier, "field-level");
});

test("resolution tier recorded in provenance", async () => {
  const { repo } = stubRepository();
  const result = await rebuildFieldMoistureEstimate({
    repository: repo,
    estimate: baseEstimate,
    sources: {
      rasterObservation: {
        sourceKey: "sentinel-hub-stats-v1:sentinel-2",
        cells: [{ measurements: { ndmi: 0.5 } }],
      },
    },
  });
  assert.equal(result.snapshot.inputs.resolutionTier, "sub-field");
});

// ===========================================================================
// 4. Scale-fit penalty
// ===========================================================================

test("computeScaleFitPenalty: small field with coarse data -> -0.05", () => {
  // fieldDiagonal 100m, resolution 9000m -> ratio 0.011 < 0.5
  assert.equal(computeScaleFitPenalty(100, 9000), -0.05);
});

test("computeScaleFitPenalty: large field with fine data -> 0", () => {
  // fieldDiagonal 500m, resolution 15m -> ratio 33.3 >= 0.5
  assert.equal(computeScaleFitPenalty(500, 15), 0);
});

test("computeScaleFitPenalty: null diagonal -> 0 (backward compat)", () => {
  assert.equal(computeScaleFitPenalty(null, 9000), 0);
  assert.equal(computeScaleFitPenalty(undefined, 9000), 0);
});

test("computeScaleFitPenalty: zero diagonal -> 0", () => {
  assert.equal(computeScaleFitPenalty(0, 9000), 0);
});

test("scale-fit penalty applied in integration for small field + regional data", async () => {
  const { repo } = stubRepository();
  const result = await rebuildFieldMoistureEstimate({
    repository: repo,
    estimate: baseEstimate,
    sources: {
      fieldDiagonalM: 100,
      weatherObservation: {
        sourceKey: "open-meteo:hourly-v1",
        airTemperatureC: 20,
        precipitationMm: 5,
        relativeHumidityPct: 60,
        soilMoisturePct: 40,
        evapotranspirationMm: 2,
      },
    },
  });
  const prov = result.snapshot.inputs;
  assert.equal(prov.scaleFitPenalty, -0.05);
  assert.ok(prov.confidenceReason!.includes("scale-fit-penalty"));
});

// ===========================================================================
// 5. Backward compatibility
// ===========================================================================

test("old snapshots without new fields still work (no observedAt, no fieldDiagonalM)", async () => {
  const { repo } = stubRepository();
  const result = await rebuildFieldMoistureEstimate({
    repository: repo,
    estimate: baseEstimate,
    sources: {
      rasterObservation: {
        sourceKey: "sentinel-hub-stats-v1:sentinel-2",
        // no observedAt
        cells: [{ measurements: { ndmi: 0.62, ndvi: 0.71 } }],
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
  const prov = result.snapshot.inputs;
  // freshnessFactor should be 1 (assumed fresh when no observedAt)
  assert.equal(prov.freshnessFactor, 1);
  // rasterAgeHours should be undefined (no observedAt to compute from)
  assert.equal(prov.rasterAgeHours, undefined);
  // scaleFitPenalty not set (no fieldDiagonalM)
  assert.equal(prov.scaleFitPenalty, undefined);
  // confidence still computed and clamped
  assert.ok(typeof prov.confidenceScore === "number");
  assert.ok(prov.confidenceScore! <= 0.97);
  assert.ok(prov.confidenceScore! >= 0);
});

test("seeded-range fallback has no new provenance fields", async () => {
  const { repo } = stubRepository();
  const result = await rebuildFieldMoistureEstimate({
    repository: repo,
    estimate: baseEstimate,
    // no sources -> seeded fallback
  });
  const prov = result.snapshot.inputs;
  assert.equal(prov.derivationMode, "seeded-range");
  assert.equal(prov.rasterAgeHours, undefined);
  assert.equal(prov.freshnessFactor, undefined);
  assert.equal(prov.agreementFlag, undefined);
  assert.equal(prov.resolutionTier, undefined);
  assert.equal(prov.scaleFitPenalty, undefined);
});

// ===========================================================================
// 6. Confidence clamping
// ===========================================================================

test("confidence score is clamped to 0..0.97", async () => {
  const { repo } = stubRepository();
  // Combine many signals to try to exceed 0.97
  const result = await rebuildFieldMoistureEstimate({
    repository: repo,
    estimate: baseEstimate,
    sources: {
      estimateTimestamp: "2026-03-31T12:00:00.000Z",
      rasterObservation: {
        sourceKey: "sentinel-hub-stats-v1:sentinel-2",
        observedAt: "2026-03-31T11:00:00.000Z",
        cells: [{ measurements: { ndmi: 0.35 } }],
      },
      weatherObservation: {
        sourceKey: "open-meteo:hourly-v1",
        airTemperatureC: 20,
        precipitationMm: 5,
        relativeHumidityPct: 70,
        soilMoisturePct: 35,
        evapotranspirationMm: 2,
      },
    },
  });
  assert.ok(result.snapshot.inputs.confidenceScore! <= 0.97);
  assert.ok(result.snapshot.inputs.confidenceScore! >= 0);
});
