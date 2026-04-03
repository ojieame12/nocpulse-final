import assert from "node:assert/strict";
import test from "node:test";
import { describeDailyForecastCondition } from "./describeDailyForecastCondition";

test("describeDailyForecastCondition keeps the compact frost labels", () => {
  assert.equal(
    describeDailyForecastCondition({
      airTemperatureMinC: -12,
      precipitationMm: 0,
      windSpeedKph: 12,
    }),
    "Deep frost",
  );
  assert.equal(
    describeDailyForecastCondition({
      airTemperatureMinC: -2,
      precipitationMm: 1,
      windSpeedKph: 12,
    }),
    "Frost risk",
  );
});

test("describeDailyForecastCondition keeps the compact precipitation labels", () => {
  assert.equal(
    describeDailyForecastCondition({
      airTemperatureMinC: 3,
      precipitationMm: 12,
      windSpeedKph: 12,
    }),
    "Heavy rain",
  );
  assert.equal(
    describeDailyForecastCondition({
      airTemperatureMinC: 3,
      precipitationMm: 3,
      windSpeedKph: 12,
    }),
    "Light rain",
  );
  assert.equal(
    describeDailyForecastCondition({
      airTemperatureMinC: 3,
      precipitationMm: 0.8,
      windSpeedKph: 12,
    }),
    "Chance of showers",
  );
});

test("describeDailyForecastCondition keeps wind and dry labels", () => {
  assert.equal(
    describeDailyForecastCondition({
      airTemperatureMinC: 6,
      precipitationMm: 0,
      windSpeedKph: 42,
    }),
    "High wind",
  );
  assert.equal(
    describeDailyForecastCondition({
      airTemperatureMinC: 6,
      precipitationMm: 0,
      windSpeedKph: 12,
    }),
    "Dry",
  );
});
