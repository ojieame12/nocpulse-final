import test from "node:test";
import assert from "node:assert/strict";
import { resolveFeatureFlags } from "./resolveFeatureFlags";
import type { FeatureFlags } from "./resolveFeatureFlags";

const EXPECTED_DEFAULTS: FeatureFlags = {
  "moisture.useDepletion": false,
  "moisture.dropFakeThermal": true,
  "soil.enableRestFallback": false,
  "ui.showDepletion": false,
  "ui.showDataSources": false,
  "ui.showHistorical": false,
};

test("resolveFeatureFlags returns defaults when raw is null", () => {
  const flags = resolveFeatureFlags(null);
  assert.deepEqual(flags, EXPECTED_DEFAULTS);
});

test("resolveFeatureFlags returns defaults when raw is undefined", () => {
  const flags = resolveFeatureFlags(undefined);
  assert.deepEqual(flags, EXPECTED_DEFAULTS);
});

test("resolveFeatureFlags returns defaults when raw is empty object", () => {
  const flags = resolveFeatureFlags({});
  assert.deepEqual(flags, EXPECTED_DEFAULTS);
});

test("resolveFeatureFlags overrides specific flags from raw object", () => {
  const flags = resolveFeatureFlags({
    "moisture.useDepletion": true,
    "ui.showDepletion": true,
  });

  assert.equal(flags["moisture.useDepletion"], true);
  assert.equal(flags["ui.showDepletion"], true);
  // Non-overridden flags stay at defaults
  assert.equal(flags["moisture.dropFakeThermal"], true);
  assert.equal(flags["soil.enableRestFallback"], false);
  assert.equal(flags["ui.showDataSources"], false);
  assert.equal(flags["ui.showHistorical"], false);
});

test("resolveFeatureFlags ignores unknown flag keys", () => {
  const flags = resolveFeatureFlags({
    "moisture.useDepletion": true,
    "unknown.flag": true,
    "another.unknown": "yes",
  });

  assert.equal(flags["moisture.useDepletion"], true);
  assert.equal(
    Object.keys(flags).length,
    Object.keys(EXPECTED_DEFAULTS).length,
  );
  assert.equal("unknown.flag" in flags, false);
  assert.equal("another.unknown" in flags, false);
});

test("resolveFeatureFlags coerces non-boolean truthy values to true", () => {
  const flags = resolveFeatureFlags({
    "moisture.useDepletion": 1,
    "ui.showDepletion": "yes",
    "ui.showDataSources": [],
  });

  assert.equal(flags["moisture.useDepletion"], true);
  assert.equal(flags["ui.showDepletion"], true);
  // Note: empty array is truthy in JS
  assert.equal(flags["ui.showDataSources"], true);
});

test("resolveFeatureFlags coerces non-boolean falsy values to false", () => {
  const flags = resolveFeatureFlags({
    "moisture.dropFakeThermal": 0,
    "ui.showDepletion": "",
    "ui.showDataSources": null,
  });

  assert.equal(flags["moisture.dropFakeThermal"], false);
  assert.equal(flags["ui.showDepletion"], false);
  assert.equal(flags["ui.showDataSources"], false);
});
