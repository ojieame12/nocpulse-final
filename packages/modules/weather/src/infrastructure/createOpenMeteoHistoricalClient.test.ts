import test from "node:test";
import assert from "node:assert/strict";
import { parseArchiveResponse } from "./createOpenMeteoHistoricalClient";

// ---------------------------------------------------------------------------
// parseArchiveResponse
// ---------------------------------------------------------------------------

test("parseArchiveResponse: correctly parses a well-formed archive response", () => {
  const raw = {
    latitude: 40.0,
    longitude: -89.0,
    daily: {
      time: ["2023-04-01", "2023-04-02", "2023-04-03"],
      soil_moisture_0_to_7cm: [0.35, 0.34, 0.33],
      soil_moisture_7_to_28cm: [0.30, 0.29, 0.28],
      soil_moisture_28_to_100cm: [0.25, 0.24, null],
    },
  };

  const result = parseArchiveResponse(raw);

  assert.equal(result.latitude, 40.0);
  assert.equal(result.longitude, -89.0);
  assert.equal(result.dailyValues.length, 3);

  assert.equal(result.dailyValues[0].date, "2023-04-01");
  assert.equal(result.dailyValues[0].layers["soil_moisture_0_to_7cm"], 0.35);
  assert.equal(result.dailyValues[0].layers["soil_moisture_7_to_28cm"], 0.30);
  assert.equal(result.dailyValues[0].layers["soil_moisture_28_to_100cm"], 0.25);

  assert.equal(result.dailyValues[2].layers["soil_moisture_28_to_100cm"], null);
});

test("parseArchiveResponse: returns empty dailyValues for missing daily payload", () => {
  const raw = {
    latitude: 40.0,
    longitude: -89.0,
  };

  const result = parseArchiveResponse(raw as any);
  assert.equal(result.dailyValues.length, 0);
  assert.equal(result.latitude, 40.0);
});

test("parseArchiveResponse: returns empty dailyValues for empty time array", () => {
  const raw = {
    latitude: 40.0,
    longitude: -89.0,
    daily: {
      time: [],
      soil_moisture_0_to_7cm: [],
      soil_moisture_7_to_28cm: [],
      soil_moisture_28_to_100cm: [],
    },
  };

  const result = parseArchiveResponse(raw);
  assert.equal(result.dailyValues.length, 0);
});

test("parseArchiveResponse: handles missing layer arrays gracefully", () => {
  const raw = {
    latitude: 40.0,
    longitude: -89.0,
    daily: {
      time: ["2023-04-01"],
      soil_moisture_0_to_7cm: [0.35],
      // soil_moisture_7_to_28cm missing entirely
      // soil_moisture_28_to_100cm missing entirely
    },
  };

  const result = parseArchiveResponse(raw as any);
  assert.equal(result.dailyValues.length, 1);
  assert.equal(result.dailyValues[0].layers["soil_moisture_0_to_7cm"], 0.35);
  assert.equal(result.dailyValues[0].layers["soil_moisture_7_to_28cm"], null);
  assert.equal(result.dailyValues[0].layers["soil_moisture_28_to_100cm"], null);
});
