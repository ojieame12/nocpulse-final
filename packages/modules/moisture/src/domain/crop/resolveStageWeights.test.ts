import test from "node:test";
import assert from "node:assert/strict";
import { resolveStageWeights } from "./resolveStageWeights";

test("resolveStageWeights returns 0.5/0.5 for null stage", () => {
  const weights = resolveStageWeights(null);
  assert.equal(weights.ndmiWeight, 0.5);
  assert.equal(weights.sarWeight, 0.5);
});

test("resolveStageWeights returns 0.2/0.8 for vegetative", () => {
  const weights = resolveStageWeights("vegetative");
  assert.equal(weights.ndmiWeight, 0.2);
  assert.equal(weights.sarWeight, 0.8);
});

test("resolveStageWeights returns 0.2/0.8 for pre-seed", () => {
  const weights = resolveStageWeights("pre-seed");
  assert.equal(weights.ndmiWeight, 0.2);
  assert.equal(weights.sarWeight, 0.8);
});

test("resolveStageWeights returns 0.7/0.3 for flowering", () => {
  const weights = resolveStageWeights("flowering");
  assert.equal(weights.ndmiWeight, 0.7);
  assert.equal(weights.sarWeight, 0.3);
});

test("resolveStageWeights returns 0.4/0.6 for ripening", () => {
  const weights = resolveStageWeights("ripening");
  assert.equal(weights.ndmiWeight, 0.4);
  assert.equal(weights.sarWeight, 0.6);
});

test("resolveStageWeights returns 0.5/0.5 for unknown stage string", () => {
  const weights = resolveStageWeights("dormant");
  assert.equal(weights.ndmiWeight, 0.5);
  assert.equal(weights.sarWeight, 0.5);
});

test("resolveStageWeights always sums to 1.0", () => {
  for (const stage of [null, "pre-seed", "vegetative", "flowering", "ripening", "unknown"]) {
    const weights = resolveStageWeights(stage);
    assert.equal(
      Number((weights.ndmiWeight + weights.sarWeight).toFixed(2)),
      1.0,
      `Weights for stage "${stage}" should sum to 1.0`,
    );
  }
});
