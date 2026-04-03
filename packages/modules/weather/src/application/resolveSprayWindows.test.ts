import assert from "node:assert/strict";
import test from "node:test";
import type { FieldWeatherForecast } from "../contracts/FieldWeatherForecast";
import {
  findSprayWindows,
  formatFieldLocalTime,
  resolveFieldTimeZone,
} from "./resolveSprayWindows";

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

test("resolveFieldTimeZone prefers America/Regina for Saskatchewan field coordinates", () => {
  assert.equal(resolveFieldTimeZone([-106.67, 52.13]), "America/Regina");
});

test("formatFieldLocalTime renders Saskatchewan spray windows in local CST", () => {
  const label = formatFieldLocalTime("2026-04-02T18:00:00.000Z", [-106.67, 52.13]);

  assert.match(label, /12:00/);
  assert.match(label, /CST/);
  assert.doesNotMatch(label, /UTC/);
});

test("formatFieldLocalTime honors an explicit field timezone without needing a label point", () => {
  const label = formatFieldLocalTime("2026-04-02T18:00:00.000Z", {
    fieldTimeZone: "America/Regina",
  });

  assert.match(label, /12:00/);
  assert.match(label, /CST/);
  assert.doesNotMatch(label, /UTC/);
});

test("findSprayWindows returns 4-hour blocks with an inclusive end hour", () => {
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

  const windows = findSprayWindows(forecasts, {
    horizonHours: 24,
    maxWindows: 1,
    consecutiveHours: 4,
  });

  assert.equal(windows.length, 1);
  assert.equal(windows[0]?.startAt, "2026-04-02T14:00:00.000Z");
  assert.equal(windows[0]?.endAt, "2026-04-02T18:00:00.000Z");
  assert.equal(windows[0]?.maxWindKph, 12);
  assert.equal(windows[0]?.minAverageTempC, 12);
  assert.equal(windows[0]?.maxAverageTempC, 17);
});
