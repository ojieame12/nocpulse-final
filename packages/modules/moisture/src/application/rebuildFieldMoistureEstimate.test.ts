import test from "node:test";
import assert from "node:assert/strict";
import { rebuildFieldMoistureEstimate } from "./rebuildFieldMoistureEstimate";

test("rebuildFieldMoistureEstimate records the weather soil baseline dataset", async () => {
  let capturedInputs: Record<string, unknown> | null = null;

  const result = await rebuildFieldMoistureEstimate({
    repository: {
      async getLatestByField() {
        return null;
      },
      async upsertSnapshot(input) {
        capturedInputs = input.inputs as Record<string, unknown>;
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
    },
    estimate: {
      workspaceId: "workspace-1",
      fieldId: "field-1",
      observedAt: "2026-03-31T10:00:00.000Z",
      sourceKey: "imagery-weather-derived-v1",
      inputs: {},
    },
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
  assert.equal(capturedInputs?.baselineDataset, "open-meteo-hourly");
  assert.equal(result.snapshot.inputs.signalBlend, "raster+weather");
  assert.equal(result.snapshot.inputs.usedWeatherSoilMoisture, true);
  assert.match(
    result.snapshot.inputs.confidenceReason ?? "",
    /baseline soil moisture/,
  );
});
