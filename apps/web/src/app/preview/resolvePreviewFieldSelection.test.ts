import assert from "node:assert/strict";
import test from "node:test";
import {
  resolvePreferredPreviewWorkspaceId,
  resolvePreviewFieldId,
} from "./resolvePreviewFieldId";

const HOPE_CREEK_WORKSPACE_ID = "8f2afceb-aefe-4e90-a24e-7ab07c4423fe";

test("resolvePreferredPreviewWorkspaceId keeps the actor workspace even when Hope Creek is present", () => {
  const workspaceId = resolvePreferredPreviewWorkspaceId(
    [
      { id: "workspace-1", slug: "batch-demo" },
      { id: "workspace-hope-creek", slug: "hope-creek-farms" },
    ],
    "workspace-fallback",
  );

  assert.equal(workspaceId, "workspace-fallback");
});

test("resolvePreferredPreviewWorkspaceId falls back to actor workspace when Hope Creek is absent", () => {
  const workspaceId = resolvePreferredPreviewWorkspaceId(
    [{ id: "workspace-1", slug: "batch-demo" }],
    "workspace-fallback",
  );

  assert.equal(workspaceId, "workspace-fallback");
});

test("resolvePreviewFieldId keeps an explicitly requested field when it exists", () => {
  const selected = resolvePreviewFieldId(
    [
      { id: "field-a", name: "Main Farm", latestMoisture: { confidence: "high", sourceKey: "sentinel-1" } },
      { id: "field-b", name: "Rath", latestMoisture: { confidence: "medium", sourceKey: "sentinel-1" } },
    ],
    HOPE_CREEK_WORKSPACE_ID,
    "field-a",
    "field-b",
  );

  assert.equal(selected, "field-b");
});

test("resolvePreviewFieldId prefers the allowlisted Hope Creek field over the catalog primary field", () => {
  const selected = resolvePreviewFieldId(
    [
      { id: "field-z", name: "Zeta North", latestMoisture: { confidence: "high", sourceKey: "sentinel-1" } },
      { id: "field-r", name: "Rath", latestMoisture: { confidence: "medium", sourceKey: "sentinel-1" } },
      { id: "field-m", name: "Main Farm", latestMoisture: { confidence: "high", sourceKey: "sentinel-1" } },
    ],
    HOPE_CREEK_WORKSPACE_ID,
    "field-z",
  );

  assert.equal(selected, "field-m");
});

test("resolvePreviewFieldId falls back to the primary field when no allowlist applies", () => {
  const selected = resolvePreviewFieldId(
    [
      { id: "field-z", name: "Zeta North", latestMoisture: { confidence: "high", sourceKey: "sentinel-1" } },
      { id: "field-r", name: "Rath", latestMoisture: { confidence: "medium", sourceKey: "sentinel-1" } },
    ],
    "workspace-dev-farm",
    "field-z",
  );

  assert.equal(selected, "field-z");
});

test("resolvePreviewFieldId explicitly prefers the strongest field when no allowlist applies", () => {
  const selected = resolvePreviewFieldId(
    [
      { id: "field-z", name: "Zeta North", latestMoisture: { confidence: "low", sourceKey: "seeded" } },
      { id: "field-r", name: "Rath", latestMoisture: { confidence: "high", sourceKey: "sentinel-1" } },
      { id: "field-a", name: "Alpha", latestMoisture: null },
    ],
    "workspace-dev-farm",
    "field-z",
  );

  assert.equal(selected, "field-r");
});

test("resolvePreviewFieldId still uses the allowlist when only lower-confidence allowlisted fields exist", () => {
  const selected = resolvePreviewFieldId(
    [
      { id: "field-z", name: "Zeta North", latestMoisture: { confidence: "high", sourceKey: "sentinel-1" } },
      { id: "field-r", name: "Rath", latestMoisture: { confidence: "low", sourceKey: "sentinel-1" } },
    ],
    HOPE_CREEK_WORKSPACE_ID,
    "field-z",
  );

  assert.equal(selected, "field-r");
});
