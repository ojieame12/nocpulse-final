import test from "node:test";
import assert from "node:assert/strict";
import { loadFieldWeatherProfile } from "./loadFieldWeatherProfile";

test("loadFieldWeatherProfile preserves forecasts when observation lookup fails", async () => {
  const profile = await loadFieldWeatherProfile({
    observationRepository: {
      async getLatestByField() {
        throw new Error("observation repository unavailable");
      },
    },
    forecastRepository: {
      async listByField() {
        return [
          {
            id: "forecast-1",
            workspaceId: "workspace-1",
            fieldId: "field-1",
            forecastRunAt: "2026-03-29T06:00:00.000Z",
            validAt: "2026-03-29T12:00:00.000Z",
            sourceKey: "open-meteo:hourly-v1",
            providerKey: "open-meteo",
            airTemperatureMinC: 6,
            airTemperatureMaxC: 12,
            precipitationMm: 1.2,
            windSpeedKph: 18,
            relativeHumidityPct: 61,
            evapotranspirationMm: 0.8,
            precipitationProbabilityPct: 40,
            createdAt: "2026-03-29T06:05:00.000Z",
            updatedAt: "2026-03-29T06:05:00.000Z",
          },
        ];
      },
    },
    workspaceId: "workspace-1",
    fieldId: "field-1",
  });

  assert.equal(profile.latestObservation, null);
  assert.equal(profile.forecasts.length, 1);
  assert.deepEqual(profile.dataAvailability, {
    latestObservation: false,
    forecasts: true,
  });
});

test("loadFieldWeatherProfile preserves the latest observation when forecast lookup fails", async () => {
  const profile = await loadFieldWeatherProfile({
    observationRepository: {
      async getLatestByField() {
        return {
          id: "observation-1",
          workspaceId: "workspace-1",
          fieldId: "field-1",
          observedAt: "2026-03-29T06:00:00.000Z",
          sourceKey: "open-meteo:hourly-v1",
          providerKey: "open-meteo",
          airTemperatureC: 9.4,
          precipitationMm: 0,
          windSpeedKph: 14,
          relativeHumidityPct: 58,
          soilMoisturePct: 33,
          soilTemperature6cmC: null,
          evapotranspirationMm: 0.5,
          provenance: {},
          createdAt: "2026-03-29T06:05:00.000Z",
          updatedAt: "2026-03-29T06:05:00.000Z",
        };
      },
    },
    forecastRepository: {
      async listByField() {
        throw new Error("forecast repository unavailable");
      },
    },
    workspaceId: "workspace-1",
    fieldId: "field-1",
  });

  assert.equal(profile.latestObservation?.providerKey, "open-meteo");
  assert.deepEqual(profile.forecasts, []);
  assert.deepEqual(profile.dataAvailability, {
    latestObservation: true,
    forecasts: false,
  });
});
