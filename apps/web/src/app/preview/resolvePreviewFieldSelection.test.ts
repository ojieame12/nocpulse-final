import assert from "node:assert/strict";
import test from "node:test";
import {
  resolvePreferredPreviewWorkspaceId,
  resolvePreviewFieldId,
} from "./resolvePreviewFieldSelection";

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

test("resolvePreviewFieldId keeps the requested field when it belongs to the calibrated set", () => {
  const fieldId = resolvePreviewFieldId(
    [
      { id: "field-bricks" },
      { id: "field-home-quarter" },
    ],
    "field-bricks",
    "field-home-quarter",
  );

  assert.equal(fieldId, "field-home-quarter");
});

test("resolvePreviewFieldId falls back to the primary Hope Creek field for stale ids", () => {
  const fieldId = resolvePreviewFieldId(
    [
      { id: "field-bricks" },
      { id: "field-home-quarter" },
    ],
    "field-bricks",
    "field-old-stale",
  );

  assert.equal(fieldId, "field-bricks");
});
