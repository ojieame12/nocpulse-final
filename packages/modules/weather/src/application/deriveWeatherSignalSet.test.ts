import assert from "node:assert/strict";
import test from "node:test";
import { deriveWeatherSignalSet } from "./deriveWeatherSignalSet";
import type { FieldWeatherForecast } from "../contracts/FieldWeatherForecast";
import type { FieldWeatherObservation } from "../contracts/FieldWeatherObservation";

const WORKSPACE_ID = "workspace-1";
const FIELD_ID = "field-1";

function createObservation(input: {
  id: string;
  observedAt: string;
  airTemperatureC: number;
  precipitationMm: number;
  soilTemperature6cmC: number | null;
}): FieldWeatherObservation {
  return {
    id: input.id,
    workspaceId: WORKSPACE_ID,
    fieldId: FIELD_ID,
    observedAt: input.observedAt,
    sourceKey: "open-meteo:hourly-v1",
    providerKey: "open-meteo",
    airTemperatureC: input.airTemperatureC,
    precipitationMm: input.precipitationMm,
    windSpeedKph: 12,
    relativeHumidityPct: 60,
    soilMoisturePct: 34,
    soilTemperature6cmC: input.soilTemperature6cmC,
    evapotranspirationMm: 0.4,
    provenance: {},
    createdAt: input.observedAt,
    updatedAt: input.observedAt,
  };
}

function createForecast(validAt: string, airTemperatureC: number): FieldWeatherForecast {
  return {
    id: `forecast-${validAt}`,
    workspaceId: WORKSPACE_ID,
    fieldId: FIELD_ID,
    forecastRunAt: "2026-04-02T12:00:00.000Z",
    validAt,
    sourceKey: "open-meteo:hourly-v1",
    providerKey: "open-meteo",
    airTemperatureMinC: airTemperatureC,
    airTemperatureMaxC: airTemperatureC,
    precipitationMm: 0,
    windSpeedKph: 10,
    relativeHumidityPct: 58,
    evapotranspirationMm: 0.2,
    precipitationProbabilityPct: 10,
    createdAt: validAt,
    updatedAt: validAt,
  };
}

test("deriveWeatherSignalSet computes soil-temperature, frost, and workability-ready signals", () => {
  const currentObservation = createObservation({
    id: "obs-4",
    observedAt: "2026-04-02T12:00:00.000Z",
    airTemperatureC: 4,
    precipitationMm: 0.7,
    soilTemperature6cmC: 8,
  });
  const recentObservations = [
    createObservation({
      id: "obs-1",
      observedAt: "2026-03-30T12:00:00.000Z",
      airTemperatureC: -2,
      precipitationMm: 0.5,
      soilTemperature6cmC: 4,
    }),
    createObservation({
      id: "obs-2",
      observedAt: "2026-03-31T12:00:00.000Z",
      airTemperatureC: 3,
      precipitationMm: 1,
      soilTemperature6cmC: 6,
    }),
    createObservation({
      id: "obs-3",
      observedAt: "2026-04-01T12:00:00.000Z",
      airTemperatureC: -1,
      precipitationMm: 2,
      soilTemperature6cmC: 7,
    }),
    currentObservation,
  ] as const;

  const forecastStart = Date.parse("2026-04-02T13:00:00.000Z");
  const forecasts = Array.from({ length: 168 }, (_, index) => {
    const validAt = new Date(forecastStart + index * 60 * 60 * 1000).toISOString();
    const dateKey = validAt.slice(0, 10);
    const hour = Number(validAt.slice(11, 13));

    let airTemperatureC = 8;
    if (dateKey === "2026-04-03" && hour === 1) {
      airTemperatureC = 1.5;
    }
    if (dateKey === "2026-04-05" && hour === 2) {
      airTemperatureC = -2.2;
    }

    return createForecast(validAt, airTemperatureC);
  });

  const signalSet = deriveWeatherSignalSet({
    workspaceId: WORKSPACE_ID,
    fieldId: FIELD_ID,
    observation: currentObservation,
    recentObservations,
    forecasts,
    soilTempThresholdC: 5,
  });

  assert.equal(signalSet.soilTemp6cmCurrentC, 8);
  assert.equal(signalSet.soilTemp6cmSustainedDays, 3);
  assert.equal(signalSet.recentPrecipTotal72hMm, 4.2);
  assert.equal(signalSet.freezeThawCycles7d, 3);
  assert.equal(signalSet.frostRiskMinTempC, 1.5);
  assert.equal(signalSet.frostRiskMinTempC7d, -2.2);
  assert.equal(signalSet.frostRiskNights7d, 2);
  assert.deepEqual(signalSet.provenance, {
    calculationMode: "observation-plus-hourly-forecast",
    forecastSampleCount24h: 24,
    forecastSampleCount72h: 72,
    forecastSampleCount168h: 168,
    observationSampleCount72h: 4,
    observationSampleCount168h: 4,
    soilTempThresholdC: 5,
    windowHours24: 24,
    windowHours72: 72,
    windowHours168: 168,
  });
});
