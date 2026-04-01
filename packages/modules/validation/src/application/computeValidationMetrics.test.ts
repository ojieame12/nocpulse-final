import test from "node:test";
import assert from "node:assert/strict";
import {
  computeValidationMetrics,
  type ValidationPair,
} from "./computeValidationMetrics";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function approxEqual(actual: number, expected: number, tolerance = 1e-6) {
  assert.ok(
    Math.abs(actual - expected) < tolerance,
    `expected ${actual} to be approximately ${expected} (tolerance ${tolerance})`,
  );
}

function assertAllNaN(metrics: ReturnType<typeof computeValidationMetrics>) {
  assert.ok(Number.isNaN(metrics.rmse), `expected rmse to be NaN, got ${metrics.rmse}`);
  assert.ok(Number.isNaN(metrics.mae), `expected mae to be NaN, got ${metrics.mae}`);
  assert.ok(Number.isNaN(metrics.pearsonR), `expected pearsonR to be NaN, got ${metrics.pearsonR}`);
  assert.ok(Number.isNaN(metrics.bias), `expected bias to be NaN, got ${metrics.bias}`);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("perfect prediction: RMSE=0, MAE=0, r=1, bias=0", () => {
  const pairs: ValidationPair[] = [
    { predicted: 30, observed: 30 },
    { predicted: 40, observed: 40 },
    { predicted: 50, observed: 50 },
    { predicted: 60, observed: 60 },
  ];

  const m = computeValidationMetrics(pairs);

  approxEqual(m.rmse, 0);
  approxEqual(m.mae, 0);
  approxEqual(m.pearsonR, 1);
  approxEqual(m.bias, 0);
});

test("constant offset: bias equals the offset, r=1", () => {
  const offset = 5;
  const pairs: ValidationPair[] = [
    { predicted: 35, observed: 30 },
    { predicted: 45, observed: 40 },
    { predicted: 55, observed: 50 },
    { predicted: 65, observed: 60 },
  ];

  const m = computeValidationMetrics(pairs);

  approxEqual(m.bias, offset);
  approxEqual(m.pearsonR, 1);
  approxEqual(m.mae, offset);
  approxEqual(m.rmse, offset);
});

test("random noise: RMSE > 0, |r| < 1", () => {
  // Pairs with some noise — not perfectly correlated
  const pairs: ValidationPair[] = [
    { predicted: 32, observed: 30 },
    { predicted: 38, observed: 40 },
    { predicted: 52, observed: 50 },
    { predicted: 57, observed: 60 },
    { predicted: 71, observed: 70 },
  ];

  const m = computeValidationMetrics(pairs);

  assert.ok(m.rmse > 0, `expected rmse > 0, got ${m.rmse}`);
  assert.ok(Math.abs(m.pearsonR) < 1, `expected |r| < 1, got ${m.pearsonR}`);
  assert.ok(Math.abs(m.pearsonR) > 0.9, `expected high correlation, got ${m.pearsonR}`);
});

test("fewer than 3 pairs: all NaN", () => {
  const pairs: ValidationPair[] = [
    { predicted: 30, observed: 30 },
    { predicted: 40, observed: 40 },
  ];

  assertAllNaN(computeValidationMetrics(pairs));
});

test("empty input: all NaN", () => {
  assertAllNaN(computeValidationMetrics([]));
});

test("single pair: all NaN", () => {
  assertAllNaN(computeValidationMetrics([{ predicted: 30, observed: 30 }]));
});

test("negative bias when predicted is consistently lower", () => {
  const pairs: ValidationPair[] = [
    { predicted: 25, observed: 30 },
    { predicted: 35, observed: 40 },
    { predicted: 45, observed: 50 },
  ];

  const m = computeValidationMetrics(pairs);

  approxEqual(m.bias, -5);
  approxEqual(m.pearsonR, 1);
});

test("zero variance in one series yields NaN pearsonR", () => {
  // All predicted values are the same — no variance
  const pairs: ValidationPair[] = [
    { predicted: 40, observed: 30 },
    { predicted: 40, observed: 40 },
    { predicted: 40, observed: 50 },
  ];

  const m = computeValidationMetrics(pairs);

  assert.ok(Number.isNaN(m.pearsonR), `expected pearsonR to be NaN when variance is zero`);
  // Other metrics should still be valid
  assert.ok(Number.isFinite(m.rmse));
  assert.ok(Number.isFinite(m.mae));
  assert.ok(Number.isFinite(m.bias));
});
