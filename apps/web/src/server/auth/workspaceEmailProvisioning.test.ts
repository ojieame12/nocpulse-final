import test from "node:test";
import assert from "node:assert/strict";
import { buildWorkspaceProvisionMembershipRows } from "./workspaceEmailProvisioning";

test("buildWorkspaceProvisionMembershipRows converts email provisions into memberships", () => {
  const rows = buildWorkspaceProvisionMembershipRows(
    [
      {
        workspace_id: "workspace-1",
        email: "grower@example.com",
        role: "member",
        created_by: "owner-1",
        created_at: "2026-03-30T10:00:00.000Z",
        claimed_by: null,
        claimed_at: null,
      },
      {
        workspace_id: "workspace-2",
        email: "grower@example.com",
        role: "viewer",
        created_by: null,
        created_at: "2026-03-30T10:05:00.000Z",
        claimed_by: null,
        claimed_at: null,
      },
    ],
    "user-1",
    "2026-03-30T11:00:00.000Z",
  );

  assert.deepEqual(rows, [
    {
      workspace_id: "workspace-1",
      user_id: "user-1",
      role: "member",
      invited_by: "owner-1",
      created_at: "2026-03-30T11:00:00.000Z",
    },
    {
      workspace_id: "workspace-2",
      user_id: "user-1",
      role: "viewer",
      invited_by: null,
      created_at: "2026-03-30T11:00:00.000Z",
    },
  ]);
});
