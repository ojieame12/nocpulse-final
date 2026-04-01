import test from "node:test";
import assert from "node:assert/strict";
import { computeKc } from "./computeKc";

test("computeKc returns 1.0 for unknown crop at any stage", () => {
  assert.equal(computeKc(null, null), 1.0);
  assert.equal(computeKc(null, "vegetative"), 1.0);
  assert.equal(computeKc(null, "flowering"), 1.0);
  assert.equal(computeKc(null, "ripening"), 1.0);
});

test("computeKc returns 1.0 for unrecognized crop name", () => {
  assert.equal(computeKc("quinoa", "flowering"), 1.0);
  assert.equal(computeKc("", "vegetative"), 1.0);
});

test("computeKc returns correct Kc for wheat at flowering (mid phase)", () => {
  assert.equal(computeKc("wheat", "flowering"), 1.15);
});

test("computeKc returns correct Kc for wheat at vegetative (initial phase)", () => {
  assert.equal(computeKc("wheat", "vegetative"), 0.3);
});

test("computeKc returns correct Kc for wheat at ripening (end phase)", () => {
  assert.equal(computeKc("wheat", "ripening"), 0.25);
});

test("computeKc returns correct Kc for corn/maize", () => {
  assert.equal(computeKc("corn", "pre-seed"), 0.3);
  assert.equal(computeKc("corn", "flowering"), 1.2);
  assert.equal(computeKc("corn", "ripening"), 0.5);
  // maize alias
  assert.equal(computeKc("maize", "flowering"), 1.2);
});

test("computeKc returns correct Kc for soybean", () => {
  assert.equal(computeKc("soybean", "vegetative"), 0.4);
  assert.equal(computeKc("soybean", "flowering"), 1.15);
  assert.equal(computeKc("soybean", "ripening"), 0.5);
});

test("computeKc returns correct Kc for canola", () => {
  assert.equal(computeKc("canola", "vegetative"), 0.35);
  assert.equal(computeKc("canola", "flowering"), 1.15);
  assert.equal(computeKc("canola", "ripening"), 0.35);
});

test("computeKc returns correct Kc for barley", () => {
  assert.equal(computeKc("barley", "vegetative"), 0.3);
  assert.equal(computeKc("barley", "flowering"), 1.15);
  assert.equal(computeKc("barley", "ripening"), 0.25);
});

test("computeKc defaults to mid-season Kc when growth stage is null", () => {
  assert.equal(computeKc("wheat", null), 1.15);
  assert.equal(computeKc("corn", null), 1.2);
});

test("computeKc is case-insensitive for crop type", () => {
  assert.equal(computeKc("Wheat", "flowering"), 1.15);
  assert.equal(computeKc("CORN", "vegetative"), 0.3);
});

test("ET adjustment: referenceET * Kc matches expected output", () => {
  const referenceET = 5.0;

  // Wheat at flowering: 5.0 * 1.15 = 5.75
  const wheatFloweringET = referenceET * computeKc("wheat", "flowering");
  assert.equal(Number(wheatFloweringET.toFixed(2)), 5.75);

  // Corn at ripening: 5.0 * 0.5 = 2.5
  const cornRipeningET = referenceET * computeKc("corn", "ripening");
  assert.equal(Number(cornRipeningET.toFixed(2)), 2.5);

  // Unknown crop: 5.0 * 1.0 = 5.0 (no change)
  const unknownET = referenceET * computeKc(null, "flowering");
  assert.equal(unknownET, 5.0);
});
