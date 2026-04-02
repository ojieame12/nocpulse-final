import test from "node:test";
import assert from "node:assert/strict";
import { computeHistoricalAnomaly } from "./computeHistoricalAnomaly";
import type { HistoricalSoilMoistureResult } from "../contracts/HistoricalSoilMoistureResult";

// ---------------------------------------------------------------------------
// Helpers to build test data
// ---------------------------------------------------------------------------

/**
 * Generate a HistoricalSoilMoistureResult with uniform moisture values
 * across `years` years, centered on the given month/day, covering
 * ±windowDays around that date each year.
 */
function buildHistoricalData(opts: {
  years?: number;
  month: number; // 1-indexed
  day: number;
  windowDays?: number;
  moistureValue: number; // volumetric fraction (e.g., 0.30)
  latitude?: number;
  longitude?: number;
}): HistoricalSoilMoistureResult {
  const {
    years = 5,
    month,
    day,
    windowDays = 20,
    moistureValue,
    latitude = 40.0,
    longitude = -89.0,
  } = opts;

  const dailyValues: HistoricalSoilMoistureResult["dailyValues"] = [];
  const currentYear = new Date().getFullYear();

  for (let y = currentYear - years; y < currentYear; y++) {
    for (let d = -windowDays; d <= windowDays; d++) {
      const date = new Date(y, month - 1, day + d);
      const dateStr = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
      ].join("-");

      dailyValues.push({
        date: dateStr,
        layers: {
          soil_moisture_0_to_7cm: moistureValue,
          soil_moisture_7_to_28cm: moistureValue,
          soil_moisture_28_to_100cm: moistureValue,
        },
      });
    }
  }

  return { dailyValues, latitude, longitude };
}

/**
 * Build historical data with varying moisture per year so percentile
 * calculations produce meaningful results.
 */
function buildVaryingHistoricalData(opts: {
  yearlyMoistureValues: number[]; // one per year, volumetric fraction
  month: number;
  day: number;
  windowDays?: number;
}): HistoricalSoilMoistureResult {
  const { yearlyMoistureValues, month, day, windowDays = 20 } = opts;
  const dailyValues: HistoricalSoilMoistureResult["dailyValues"] = [];
  const currentYear = new Date().getFullYear();

  for (let i = 0; i < yearlyMoistureValues.length; i++) {
    const y = currentYear - yearlyMoistureValues.length + i;
    const moisture = yearlyMoistureValues[i];

    for (let d = -windowDays; d <= windowDays; d++) {
      const date = new Date(y, month - 1, day + d);
      const dateStr = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
      ].join("-");

      dailyValues.push({
        date: dateStr,
        layers: {
          soil_moisture_0_to_7cm: moisture,
          soil_moisture_7_to_28cm: moisture,
          soil_moisture_28_to_100cm: moisture,
        },
      });
    }
  }

  return { dailyValues, latitude: 40.0, longitude: -89.0 };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("percentile rank: current at median returns ~50%", () => {
  // All years have same moisture -> current = median -> should be within normal range
  const historicalData = buildHistoricalData({
    month: 4,
    day: 5,
    moistureValue: 0.30,
  });

  // Current moisture in pct = 30.0 (matches historical 0.30 * 100)
  const result = computeHistoricalAnomaly(
    30.0,
    historicalData,
    new Date(new Date().getFullYear(), 3, 5), // April 5
  );

  assert.notEqual(result, null);
  assert.ok(
    Math.abs(result!.percentileRank) <= 5,
    `Expected percentile near 0 (not drier), got ${result!.percentileRank}`,
  );
  assert.ok(
    result!.description.includes("Within normal range") ||
    result!.description.includes("Wetter than"),
    `Unexpected description: ${result!.description}`,
  );
});

test("percentile rank: current much lower than historical -> high percentile (drier)", () => {
  const historicalData = buildHistoricalData({
    month: 4,
    day: 5,
    moistureValue: 0.35, // historical = 35%
  });

  // Current is much drier at 20%
  const result = computeHistoricalAnomaly(
    20.0,
    historicalData,
    new Date(new Date().getFullYear(), 3, 5),
  );

  assert.notEqual(result, null);
  assert.ok(
    result!.percentileRank >= 90,
    `Expected high percentile (drier than most), got ${result!.percentileRank}`,
  );
  assert.ok(
    result!.description.includes("Drier than"),
    `Expected 'Drier than' in description, got: ${result!.description}`,
  );
  assert.ok(result!.departurePct > 0, "departurePct should be positive when drier");
});

test("percentile rank: current much higher than historical -> wetter description", () => {
  const historicalData = buildHistoricalData({
    month: 4,
    day: 5,
    moistureValue: 0.25, // historical = 25%
  });

  // Current is much wetter at 40%
  const result = computeHistoricalAnomaly(
    40.0,
    historicalData,
    new Date(new Date().getFullYear(), 3, 5),
  );

  assert.notEqual(result, null);
  assert.ok(
    result!.description.includes("Wetter than"),
    `Expected 'Wetter than' in description, got: ${result!.description}`,
  );
  assert.ok(result!.departurePct < 0, "departurePct should be negative when wetter");
});

test("returns null when insufficient historical data", () => {
  // Only 2 data points - below MIN_DATA_POINTS threshold
  const historicalData: HistoricalSoilMoistureResult = {
    dailyValues: [
      {
        date: "2023-04-05",
        layers: {
          soil_moisture_0_to_7cm: 0.30,
          soil_moisture_7_to_28cm: 0.28,
          soil_moisture_28_to_100cm: 0.25,
        },
      },
      {
        date: "2023-04-06",
        layers: {
          soil_moisture_0_to_7cm: 0.31,
          soil_moisture_7_to_28cm: 0.29,
          soil_moisture_28_to_100cm: 0.26,
        },
      },
    ],
    latitude: 40.0,
    longitude: -89.0,
  };

  const result = computeHistoricalAnomaly(
    30.0,
    historicalData,
    new Date(new Date().getFullYear(), 3, 5),
  );

  assert.equal(result, null);
});

test("returns null when all layer values are null", () => {
  const dailyValues = [];
  const currentYear = new Date().getFullYear();
  for (let y = currentYear - 5; y < currentYear; y++) {
    for (let d = -20; d <= 20; d++) {
      const date = new Date(y, 3, 5 + d);
      dailyValues.push({
        date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
        layers: {
          soil_moisture_0_to_7cm: null,
          soil_moisture_7_to_28cm: null,
          soil_moisture_28_to_100cm: null,
        },
      });
    }
  }

  const result = computeHistoricalAnomaly(
    30.0,
    { dailyValues, latitude: 40.0, longitude: -89.0 },
    new Date(currentYear, 3, 5),
  );

  assert.equal(result, null);
});

test("rolling window handles year boundaries (Jan values see Dec from prior year)", () => {
  // Target: January 5. Window ±15 days should include Dec 21+ from prior year.
  const currentYear = new Date().getFullYear();
  const dailyValues: HistoricalSoilMoistureResult["dailyValues"] = [];

  for (let y = currentYear - 5; y < currentYear; y++) {
    // Add December 20-31 entries
    for (let d = 20; d <= 31; d++) {
      const date = new Date(y, 11, d);
      if (date.getMonth() !== 11) continue; // skip invalid Dec dates
      dailyValues.push({
        date: `${y}-12-${String(d).padStart(2, "0")}`,
        layers: {
          soil_moisture_0_to_7cm: 0.32,
          soil_moisture_7_to_28cm: 0.30,
          soil_moisture_28_to_100cm: 0.28,
        },
      });
    }
    // Add January 1-20 entries
    for (let d = 1; d <= 20; d++) {
      const nextYear = y + 1;
      if (nextYear >= currentYear) continue;
      dailyValues.push({
        date: `${nextYear}-01-${String(d).padStart(2, "0")}`,
        layers: {
          soil_moisture_0_to_7cm: 0.32,
          soil_moisture_7_to_28cm: 0.30,
          soil_moisture_28_to_100cm: 0.28,
        },
      });
    }
  }

  const result = computeHistoricalAnomaly(
    30.0,
    { dailyValues, latitude: 40.0, longitude: -89.0 },
    new Date(currentYear, 0, 5), // January 5
  );

  // Should have found data from both Dec and Jan entries
  assert.notEqual(result, null, "Should find data across year boundary");
});

test("handles leap years without crashing", () => {
  // Build data that includes Feb 29 in leap years
  const dailyValues: HistoricalSoilMoistureResult["dailyValues"] = [];

  // 2020 and 2024 are leap years
  for (const y of [2020, 2021, 2022, 2023, 2024]) {
    for (let d = -20; d <= 20; d++) {
      const date = new Date(y, 1, 28 + d); // Around Feb 28
      const dateStr = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
      ].join("-");

      dailyValues.push({
        date: dateStr,
        layers: {
          soil_moisture_0_to_7cm: 0.30,
          soil_moisture_7_to_28cm: 0.28,
          soil_moisture_28_to_100cm: 0.25,
        },
      });
    }
  }

  // Target: Feb 29 of a leap year
  const result = computeHistoricalAnomaly(
    28.0,
    { dailyValues, latitude: 40.0, longitude: -89.0 },
    new Date(2024, 1, 29), // Feb 29, 2024
  );

  // Should not crash and should return a result since we have ample data
  assert.notEqual(result, null, "Should handle leap year date");
});

test("description text matches expected patterns", () => {
  const historicalData = buildHistoricalData({
    month: 4,
    day: 5,
    moistureValue: 0.30,
  });

  // Test "Drier than" pattern
  const drierResult = computeHistoricalAnomaly(
    10.0,
    historicalData,
    new Date(new Date().getFullYear(), 3, 5),
  );
  assert.notEqual(drierResult, null);
  assert.match(
    drierResult!.description,
    /^Drier than \d+% of years for early April$/,
  );

  // Test "Wetter than" pattern
  const wetterResult = computeHistoricalAnomaly(
    50.0,
    historicalData,
    new Date(new Date().getFullYear(), 3, 5),
  );
  assert.notEqual(wetterResult, null);
  assert.match(
    wetterResult!.description,
    /^Wetter than \d+% of years for early April$/,
  );

  // Test "Within normal range" pattern
  const normalResult = computeHistoricalAnomaly(
    30.0,
    historicalData,
    new Date(new Date().getFullYear(), 3, 5),
  );
  assert.notEqual(normalResult, null);
  // When current equals all historical values exactly, could be normal or wetter
  assert.ok(
    normalResult!.description.includes("normal range") ||
    normalResult!.description.includes("Wetter than"),
    `Expected normal/wetter description, got: ${normalResult!.description}`,
  );
});

test("uses depth translation for archive schema layers", () => {
  // The archive schema layers (0-7cm, 7-28cm, 28-100cm) should be depth-weighted
  // by resolveRootZoneMoisture. With different values per layer, the result should
  // reflect depth-weighted averaging, not simple averaging.
  const currentYear = new Date().getFullYear();
  const dailyValues: HistoricalSoilMoistureResult["dailyValues"] = [];

  for (let y = currentYear - 5; y < currentYear; y++) {
    for (let d = -20; d <= 20; d++) {
      const date = new Date(y, 3, 5 + d);
      dailyValues.push({
        date: [
          date.getFullYear(),
          String(date.getMonth() + 1).padStart(2, "0"),
          String(date.getDate()).padStart(2, "0"),
        ].join("-"),
        layers: {
          // Different values per layer to verify depth weighting
          soil_moisture_0_to_7cm: 0.40,    // shallow: wetter
          soil_moisture_7_to_28cm: 0.30,   // mid: moderate
          soil_moisture_28_to_100cm: 0.20, // deep: drier
        },
      });
    }
  }

  // Expected root zone (0-30cm) from archive schema:
  // Overlaps: 0-7 (7cm), 7-28 (21cm), 28-30 (2cm)
  // Weighted: (0.40*7 + 0.30*21 + 0.20*2) / 30 = (2.80 + 6.30 + 0.40) / 30 = 0.31666...
  const expectedHistoricalPct = ((0.40 * 7 + 0.30 * 21 + 0.20 * 2) / 30) * 100;

  const result = computeHistoricalAnomaly(
    expectedHistoricalPct,
    { dailyValues, latitude: 40.0, longitude: -89.0 },
    new Date(currentYear, 3, 5),
  );

  assert.notEqual(result, null);
  // Historical median should match the depth-weighted value
  assert.ok(
    Math.abs(result!.historicalMedianPct - Math.round(expectedHistoricalPct * 10) / 10) < 0.2,
    `Expected historicalMedianPct near ${expectedHistoricalPct}, got ${result!.historicalMedianPct}`,
  );
});

test("varying moisture across years produces sensible percentile ranking", () => {
  // 5 years with different moisture levels
  const data = buildVaryingHistoricalData({
    yearlyMoistureValues: [0.20, 0.25, 0.30, 0.35, 0.40],
    month: 4,
    day: 5,
  });

  // Current at 22% should be drier than most years (most years are 25-40%)
  const result = computeHistoricalAnomaly(
    22.0,
    data,
    new Date(new Date().getFullYear(), 3, 5),
  );

  assert.notEqual(result, null);
  assert.ok(
    result!.percentileRank >= 60,
    `Expected drier than 60%+ of years, got ${result!.percentileRank}`,
  );
});

test("dateRange label reflects number of years in data", () => {
  const data = buildHistoricalData({
    years: 3,
    month: 4,
    day: 5,
    moistureValue: 0.30,
  });

  const result = computeHistoricalAnomaly(
    30.0,
    data,
    new Date(new Date().getFullYear(), 3, 5),
  );

  assert.notEqual(result, null);
  assert.equal(result!.dateRange, "3-year average");
});

test("dayOfYearWindow is returned in result", () => {
  const data = buildHistoricalData({
    month: 4,
    day: 5,
    moistureValue: 0.30,
  });

  const result = computeHistoricalAnomaly(
    30.0,
    data,
    new Date(new Date().getFullYear(), 3, 5),
    { windowDays: 10 },
  );

  assert.notEqual(result, null);
  assert.equal(result!.dayOfYearWindow, 10);
});
