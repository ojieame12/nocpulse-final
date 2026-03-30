import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_WORKSPACE_SETTINGS,
  normalizeWorkspaceSettings,
} from "./workspaceSettings";

test("normalizeWorkspaceSettings falls back to defaults for missing values", () => {
  const result = normalizeWorkspaceSettings({
    emailAlerts: false,
  });

  assert.deepEqual(result, {
    ...DEFAULT_WORKSPACE_SETTINGS,
    emailAlerts: false,
  });
});

test("normalizeWorkspaceSettings rejects invalid enum values", () => {
  const result = normalizeWorkspaceSettings({
    units: "bad" as never,
    tempUnit: "bad" as never,
  });

  assert.equal(result.units, "metric");
  assert.equal(result.tempUnit, "celsius");
});
