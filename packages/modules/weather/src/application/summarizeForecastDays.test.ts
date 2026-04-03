import assert from "node:assert/strict";
import test from "node:test";
import type { FieldWeatherForecast } from "../contracts/FieldWeatherForecast";
import { summarizeForecastDays } from "./summarizeForecastDays";

function createForecast(input: {
  id: string;
  validAt: string;
  minC: number;
  maxC: number;
  precipitationMm: number;
  precipitationProbabilityPct: number | null;
  windSpeedKph: number;
}): FieldWeatherForecast {
  return {
    id: input.id,
    workspaceId: "workspace-1",
    fieldId: "field-1",
    forecastRunAt: "2026-04-03T00:00:00.000Z",
    validAt: input.validAt,
    sourceKey: "open-meteo:hourly-v1",
    providerKey: "open-meteo",
    airTemperatureMinC: input.minC,
    airTemperatureMaxC: input.maxC,
    precipitationMm: input.precipitationMm,
    windSpeedKph: input.windSpeedKph,
    relativeHumidityPct: null,
    evapotranspirationMm: null,
    precipitationProbabilityPct: input.precipitationProbabilityPct,
    createdAt: "2026-04-03T00:00:00.000Z",
    updatedAt: "2026-04-03T00:00:00.000Z",
  };
}

test("summarizeForecastDays aggregates multiple forecast periods into one daily row", () => {
  const days = summarizeForecastDays([
    createForecast({
      id: "f1",
      validAt: "2026-04-03T06:00:00.000Z",
      minC: 2,
      maxC: 8,
      precipitationMm: 0.4,
      precipitationProbabilityPct: 20,
      windSpeedKph: 16,
    }),
    createForecast({
      id: "f2",
      validAt: "2026-04-03T18:00:00.000Z",
      minC: 4,
      maxC: 12,
      precipitationMm: 1.1,
      precipitationProbabilityPct: 55,
      windSpeedKph: 24,
    }),
  ]);

  assert.equal(days.length, 1);
  assert.equal(days[0]?.dateKey, "2026-04-03");
  assert.equal(days[0]?.airTemperatureMinC, 2);
  assert.equal(days[0]?.airTemperatureMaxC, 12);
  assert.equal(days[0]?.precipitationMm, 1.5);
  assert.equal(days[0]?.precipitationProbabilityPct, 55);
  assert.equal(days[0]?.windSpeedKph, 24);
  assert.equal(days[0]?.forecastCount, 2);
});

test("summarizeForecastDays groups by field-local day for Saskatchewan fields", () => {
  const days = summarizeForecastDays(
    [
      createForecast({
        id: "f1",
        validAt: "2026-04-03T02:00:00.000Z",
        minC: 1,
        maxC: 5,
        precipitationMm: 0,
        precipitationProbabilityPct: 0,
        windSpeedKph: 10,
      }),
      createForecast({
        id: "f2",
        validAt: "2026-04-03T10:00:00.000Z",
        minC: 3,
        maxC: 9,
        precipitationMm: 0.2,
        precipitationProbabilityPct: 15,
        windSpeedKph: 14,
      }),
    ],
    { fieldLabelPoint: [-106.67, 52.13] },
  );

  assert.equal(days.length, 2);
  assert.equal(days[0]?.dateKey, "2026-04-02");
  assert.equal(days[1]?.dateKey, "2026-04-03");
});
