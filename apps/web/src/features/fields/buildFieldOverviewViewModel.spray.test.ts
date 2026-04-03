import assert from "node:assert/strict";
import test from "node:test";
import type { FieldWeatherForecast } from "@fieldpulse/module-weather";
import { resolveSprayWindowRecommendation } from "./buildFieldOverviewViewModel.spray";

const WORKSPACE_ID = "workspace-1";
const FIELD_ID = "field-1";

function createForecast(input: {
  validAt: string;
  airTemperatureC: number;
  windSpeedKph?: number;
  precipitationMm?: number;
  precipitationProbabilityPct?: number | null;
}): FieldWeatherForecast {
  return {
    id: `forecast-${input.validAt}`,
    workspaceId: WORKSPACE_ID,
    fieldId: FIELD_ID,
    forecastRunAt: "2026-04-02T12:00:00.000Z",
    validAt: input.validAt,
    sourceKey: "open-meteo:hourly-v1",
    providerKey: "open-meteo",
    airTemperatureMinC: input.airTemperatureC,
    airTemperatureMaxC: input.airTemperatureC,
    precipitationMm: input.precipitationMm ?? 0,
    windSpeedKph: input.windSpeedKph ?? 12,
    relativeHumidityPct: 60,
    evapotranspirationMm: 0.2,
    precipitationProbabilityPct: input.precipitationProbabilityPct ?? 10,
    createdAt: input.validAt,
    updatedAt: input.validAt,
  };
}

test("resolveSprayWindowRecommendation returns the first eligible 4-hour block", () => {
  const forecasts = [
    createForecast({ validAt: "2026-04-02T13:00:00.000Z", airTemperatureC: 8, windSpeedKph: 10 }),
    createForecast({ validAt: "2026-04-02T14:00:00.000Z", airTemperatureC: 12 }),
    createForecast({ validAt: "2026-04-02T15:00:00.000Z", airTemperatureC: 14 }),
    createForecast({ validAt: "2026-04-02T16:00:00.000Z", airTemperatureC: 16 }),
    createForecast({ validAt: "2026-04-02T17:00:00.000Z", airTemperatureC: 17 }),
    createForecast({ validAt: "2026-04-02T18:00:00.000Z", airTemperatureC: 18 }),
    createForecast({ validAt: "2026-04-02T19:00:00.000Z", airTemperatureC: 17 }),
    createForecast({ validAt: "2026-04-02T20:00:00.000Z", airTemperatureC: 15 }),
  ];

  const recommendation = resolveSprayWindowRecommendation({
    cropLabel: "Canola",
    sprayWindowCount24h: 1,
    forecasts,
    fieldLabelPoint: [-106.67, 52.13],
    weatherSourceLabel: "open-meteo · hourly-v1",
  });

  assert.equal(recommendation?.title, "Spray window open");
  assert.equal(recommendation?.urgency, "Ready");
  assert.match(recommendation?.whyNow ?? "", /earliest 4-hour spray block/i);
  assert.match(recommendation?.whyNow ?? "", /Wind up to 12 km\/h/i);
  assert.match(recommendation?.explanation ?? "", /1 spray window/i);
  assert.doesNotMatch(recommendation?.whyNow ?? "", /UTC/);
  assert.match(recommendation?.whyNow ?? "", /12:00/);
  assert.match(recommendation?.whyNow ?? "", /CST/);
  assert.match(recommendation?.signals[0]?.detail ?? "", /open-meteo · hourly-v1/i);
  assert.match(recommendation?.signals[0]?.detail ?? "", /12:00/);
  assert.match(recommendation?.signals[0]?.detail ?? "", /CST/);
  assert.equal(
    recommendation?.inspectFirst,
    "Confirm the target crop stage and product label first, then re-check wind exposure on the most open field edges before committing the full pass.",
  );
});

test("resolveSprayWindowRecommendation returns null when no eligible 4-hour block exists", () => {
  const forecasts = Array.from({ length: 8 }, (_, index) =>
    createForecast({
      validAt: new Date(Date.parse("2026-04-02T13:00:00.000Z") + index * 60 * 60 * 1000).toISOString(),
      airTemperatureC: 11,
      windSpeedKph: 24,
    }),
  );

  const recommendation = resolveSprayWindowRecommendation({
    cropLabel: "Wheat",
    sprayWindowCount24h: 0,
    forecasts,
    fieldLabelPoint: [-106.67, 52.13],
    weatherSourceLabel: "open-meteo · hourly-v1",
  });

  assert.equal(recommendation, null);
});
