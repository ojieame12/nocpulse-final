import test from "node:test";
import assert from "node:assert/strict";
import { resolveRequestedWorkspaceId } from "./resolveRequestContext";

test("resolveRequestedWorkspaceId ignores placeholder workspace ids", () => {
  const request = new Request("http://localhost/api/test", {
    headers: {
      "x-fieldpulse-workspace-id": "__empty__",
    },
  });

  assert.equal(resolveRequestedWorkspaceId(request), null);
  assert.equal(resolveRequestedWorkspaceId(request, "__empty__"), null);
  assert.equal(resolveRequestedWorkspaceId(request, "workspace-123"), "workspace-123");
});

test("resolveRequestedWorkspaceId prefers real header values", () => {
  const request = new Request("http://localhost/api/test", {
    headers: {
      "x-fieldpulse-workspace-id": "workspace-456",
    },
  });

  assert.equal(resolveRequestedWorkspaceId(request, "workspace-123"), "workspace-456");
});
