import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveCanonicalMoisture,
  resolveRootZoneMoisture,
} from "./depthTranslation";

// ---------------------------------------------------------------------------
// Forecast schema – root zone 0-30cm
// ---------------------------------------------------------------------------

test("forecast schema: root zone 0-30cm depth-weights all overlapping layers", () => {
  // Layers: 0-1 (1cm), 1-3 (2cm), 3-9 (6cm), 9-27 (18cm), 27-81 (overlap 27-30 = 3cm)
  // Total target range = 30cm
  // Weights: 1/30, 2/30, 6/30, 18/30, 3/30 = 30/30
  const layerValues: Record<string, number> = {
    soil_moisture_0_to_1cm: 0.40,
    soil_moisture_1_to_3cm: 0.38,
    soil_moisture_3_to_9cm: 0.35,
    soil_moisture_9_to_27cm: 0.30,
    soil_moisture_27_to_81cm: 0.25,
  };

  const result = resolveRootZoneMoisture(layerValues, "forecast");
  assert.notEqual(result, null);

  // Manual calculation:
  // (0.40*1 + 0.38*2 + 0.35*6 + 0.30*18 + 0.25*3) / 30
  // = (0.40 + 0.76 + 2.10 + 5.40 + 0.75) / 30
  // = 9.41 / 30 = 0.31366...
  const expected = (0.40 * 1 + 0.38 * 2 + 0.35 * 6 + 0.30 * 18 + 0.25 * 3) / 30;
  assert.ok(Math.abs(result! - expected) < 1e-10, `expected ~${expected}, got ${result}`);
});

// ---------------------------------------------------------------------------
// Archive schema – root zone 0-30cm
// ---------------------------------------------------------------------------

test("archive schema: root zone 0-30cm depth-weights all overlapping layers", () => {
  // Layers: 0-7 (7cm), 7-28 (21cm), 28-100 (overlap 28-30 = 2cm)
  // 100-255 has no overlap with 0-30
  // Total overlapping depth = 7 + 21 + 2 = 30cm
  const layerValues: Record<string, number> = {
    soil_moisture_0_to_7cm: 0.40,
    soil_moisture_7_to_28cm: 0.35,
    soil_moisture_28_to_100cm: 0.28,
    soil_moisture_100_to_255cm: 0.20,
  };

  const result = resolveRootZoneMoisture(layerValues, "archive");
  assert.notEqual(result, null);

  // (0.40*7 + 0.35*21 + 0.28*2) / 30 = (2.80 + 7.35 + 0.56) / 30 = 10.71/30
  const expected = (0.40 * 7 + 0.35 * 21 + 0.28 * 2) / 30;
  assert.ok(Math.abs(result! - expected) < 1e-10, `expected ~${expected}, got ${result}`);
});

// ---------------------------------------------------------------------------
// Cross-schema consistency
// ---------------------------------------------------------------------------

test("both schemas produce similar values for uniform moisture data", () => {
  // When all layers report the same moisture, depth-weighting should return
  // that exact value regardless of the schema.
  const uniformValue = 0.32;

  const forecastLayers: Record<string, number> = {
    soil_moisture_0_to_1cm: uniformValue,
    soil_moisture_1_to_3cm: uniformValue,
    soil_moisture_3_to_9cm: uniformValue,
    soil_moisture_9_to_27cm: uniformValue,
    soil_moisture_27_to_81cm: uniformValue,
  };

  const archiveLayers: Record<string, number> = {
    soil_moisture_0_to_7cm: uniformValue,
    soil_moisture_7_to_28cm: uniformValue,
    soil_moisture_28_to_100cm: uniformValue,
    soil_moisture_100_to_255cm: uniformValue,
  };

  const forecastResult = resolveRootZoneMoisture(forecastLayers, "forecast");
  const archiveResult = resolveRootZoneMoisture(archiveLayers, "archive");

  assert.ok(forecastResult !== null);
  assert.ok(archiveResult !== null);
  assert.ok(
    Math.abs(forecastResult - archiveResult) < 1e-10,
    `forecast ${forecastResult} !== archive ${archiveResult}`,
  );
  assert.ok(
    Math.abs(forecastResult - uniformValue) < 1e-10,
    `expected ${uniformValue}, got ${forecastResult}`,
  );
});

// ---------------------------------------------------------------------------
// Null handling
// ---------------------------------------------------------------------------

test("null layer values are skipped and weight is redistributed", () => {
  // Skip the 9-27cm layer; remaining layers share redistributed weight
  const layerValues: Record<string, number | null> = {
    soil_moisture_0_to_1cm: 0.40,
    soil_moisture_1_to_3cm: 0.38,
    soil_moisture_3_to_9cm: 0.35,
    soil_moisture_9_to_27cm: null,
    soil_moisture_27_to_81cm: 0.25,
  };

  const result = resolveRootZoneMoisture(layerValues, "forecast");
  assert.notEqual(result, null);

  // Available overlap: 1 + 2 + 6 + 3 = 12cm out of 30cm
  // Raw weighted sum: (0.40*1 + 0.38*2 + 0.35*6 + 0.25*3) / 30
  // But we redistribute, so divide by (12/30) instead of 1:
  // = (0.40*1 + 0.38*2 + 0.35*6 + 0.25*3) / 12
  const rawSum = 0.40 * 1 + 0.38 * 2 + 0.35 * 6 + 0.25 * 3;
  const expected = rawSum / 12;
  assert.ok(Math.abs(result! - expected) < 1e-10, `expected ~${expected}, got ${result}`);
});

test("all null values returns null", () => {
  const layerValues: Record<string, number | null> = {
    soil_moisture_0_to_1cm: null,
    soil_moisture_1_to_3cm: null,
    soil_moisture_3_to_9cm: null,
    soil_moisture_9_to_27cm: null,
    soil_moisture_27_to_81cm: null,
  };

  const result = resolveRootZoneMoisture(layerValues, "forecast");
  assert.equal(result, null);
});

// ---------------------------------------------------------------------------
// Zero overlap
// ---------------------------------------------------------------------------

test("zero overlap returns null", () => {
  // Target 200-300cm has no overlap with any forecast layer (max is 81cm)
  const layerValues: Record<string, number> = {
    soil_moisture_0_to_1cm: 0.40,
    soil_moisture_1_to_3cm: 0.38,
    soil_moisture_3_to_9cm: 0.35,
    soil_moisture_9_to_27cm: 0.30,
    soil_moisture_27_to_81cm: 0.25,
  };

  const result = resolveCanonicalMoisture(layerValues, "forecast", 200, 300);
  assert.equal(result, null);
});

test("inverted range (top > bottom) returns null", () => {
  const layerValues: Record<string, number> = {
    soil_moisture_0_to_1cm: 0.40,
  };
  const result = resolveCanonicalMoisture(layerValues, "forecast", 30, 10);
  assert.equal(result, null);
});

// ---------------------------------------------------------------------------
// Custom depth for deep-rooted crops
// ---------------------------------------------------------------------------

test("custom depth 0-60cm for deep-rooted crops", () => {
  const layerValues: Record<string, number> = {
    soil_moisture_0_to_1cm: 0.40,
    soil_moisture_1_to_3cm: 0.38,
    soil_moisture_3_to_9cm: 0.35,
    soil_moisture_9_to_27cm: 0.30,
    soil_moisture_27_to_81cm: 0.25,
  };

  const result = resolveRootZoneMoisture(layerValues, "forecast", 60);
  assert.notEqual(result, null);

  // Overlaps: 0-1 (1cm), 1-3 (2cm), 3-9 (6cm), 9-27 (18cm), 27-60 (33cm)
  // Total = 60cm
  const expected =
    (0.40 * 1 + 0.38 * 2 + 0.35 * 6 + 0.30 * 18 + 0.25 * 33) / 60;
  assert.ok(Math.abs(result! - expected) < 1e-10, `expected ~${expected}, got ${result}`);
});

test("custom depth 0-60cm archive schema", () => {
  const layerValues: Record<string, number> = {
    soil_moisture_0_to_7cm: 0.40,
    soil_moisture_7_to_28cm: 0.35,
    soil_moisture_28_to_100cm: 0.28,
    soil_moisture_100_to_255cm: 0.20,
  };

  const result = resolveRootZoneMoisture(layerValues, "archive", 60);
  assert.notEqual(result, null);

  // Overlaps: 0-7 (7cm), 7-28 (21cm), 28-60 (32cm), 100-255 has no overlap
  const expected = (0.40 * 7 + 0.35 * 21 + 0.28 * 32) / 60;
  assert.ok(Math.abs(result! - expected) < 1e-10, `expected ~${expected}, got ${result}`);
});

// ---------------------------------------------------------------------------
// resolveCanonicalMoisture with explicit canonical range
// ---------------------------------------------------------------------------

test("resolveCanonicalMoisture for 10-30cm canonical range", () => {
  const layerValues: Record<string, number> = {
    soil_moisture_0_to_1cm: 0.40,
    soil_moisture_1_to_3cm: 0.38,
    soil_moisture_3_to_9cm: 0.35,
    soil_moisture_9_to_27cm: 0.30,
    soil_moisture_27_to_81cm: 0.25,
  };

  const result = resolveCanonicalMoisture(layerValues, "forecast", 10, 30);
  assert.notEqual(result, null);

  // Overlaps with 10-30: 9-27 -> 10-27 = 17cm, 27-81 -> 27-30 = 3cm
  // 0-1, 1-3, 3-9 have no overlap with 10-30
  const expected = (0.30 * 17 + 0.25 * 3) / 20;
  assert.ok(Math.abs(result! - expected) < 1e-10, `expected ~${expected}, got ${result}`);
});

// ---------------------------------------------------------------------------
// Missing keys in layerValues (not present at all)
// ---------------------------------------------------------------------------

test("missing keys are treated as null", () => {
  // Only provide one layer
  const layerValues: Record<string, number> = {
    soil_moisture_9_to_27cm: 0.30,
  };

  const result = resolveRootZoneMoisture(layerValues, "forecast");
  assert.notEqual(result, null);

  // Only 9-27 overlaps 0-30 with 18cm overlap
  // No other layers present, so weight is redistributed to just this one
  assert.ok(Math.abs(result! - 0.30) < 1e-10, `expected 0.30, got ${result}`);
});
