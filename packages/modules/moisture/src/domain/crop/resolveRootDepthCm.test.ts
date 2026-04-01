import test from "node:test";
import assert from "node:assert/strict";
import { resolveRootDepthCm } from "./resolveRootDepthCm";

// ---------------------------------------------------------------------------
// Default stage depths (no crop-specific override)
// ---------------------------------------------------------------------------

test("unknown crop + unknown stage → 30cm default", () => {
  assert.equal(resolveRootDepthCm("unknown-crop", "unknown-stage"), 30);
});

test("null inputs → 30cm default", () => {
  assert.equal(resolveRootDepthCm(null, null), 30);
});

test("undefined inputs → 30cm default", () => {
  assert.equal(resolveRootDepthCm(undefined, undefined), 30);
});

test("pre-seed any crop → 15cm (shallow)", () => {
  assert.equal(resolveRootDepthCm("soybean", "pre-seed"), 15);
  assert.equal(resolveRootDepthCm("unknown", "pre-seed"), 15);
  assert.equal(resolveRootDepthCm(null, "pre-seed"), 15);
});

test("vegetative stage default → 25cm", () => {
  assert.equal(resolveRootDepthCm(null, "vegetative"), 25);
});

test("flowering stage default → 40cm", () => {
  assert.equal(resolveRootDepthCm(null, "flowering"), 40);
});

test("ripening stage default → 35cm", () => {
  assert.equal(resolveRootDepthCm(null, "ripening"), 35);
});

// ---------------------------------------------------------------------------
// Crop-specific overrides
// ---------------------------------------------------------------------------

test("wheat at flowering → 35cm", () => {
  assert.equal(resolveRootDepthCm("wheat", "flowering"), 35);
});

test("corn at flowering → 50cm", () => {
  assert.equal(resolveRootDepthCm("corn", "flowering"), 50);
});

test("maize at flowering → 50cm (alias for corn)", () => {
  assert.equal(resolveRootDepthCm("maize", "flowering"), 50);
});

test("barley at flowering → 30cm", () => {
  assert.equal(resolveRootDepthCm("barley", "flowering"), 30);
});

test("canola at flowering → 40cm (same as default)", () => {
  assert.equal(resolveRootDepthCm("canola", "flowering"), 40);
});

test("soybean at flowering → 35cm", () => {
  assert.equal(resolveRootDepthCm("soybean", "flowering"), 35);
});

// ---------------------------------------------------------------------------
// Case insensitivity
// ---------------------------------------------------------------------------

test("crop type matching is case-insensitive", () => {
  assert.equal(resolveRootDepthCm("CORN", "flowering"), 50);
  assert.equal(resolveRootDepthCm("Wheat", "flowering"), 35);
});

test("growth stage matching is case-insensitive", () => {
  assert.equal(resolveRootDepthCm("corn", "FLOWERING"), 50);
  assert.equal(resolveRootDepthCm(null, "PRE-SEED"), 15);
});

// ---------------------------------------------------------------------------
// Integration: explicit rootZoneDepthCm overrides computed value
// (tested at the rebuildFieldMoistureEstimate level)
// ---------------------------------------------------------------------------

test("crop override falls back to default stage depth for unstaged entries", () => {
  // Wheat only overrides flowering; vegetative should use default 25cm
  // (unless wheat has a vegetative override — it doesn't in current table)
  assert.equal(resolveRootDepthCm("wheat", "vegetative"), 25);
});
