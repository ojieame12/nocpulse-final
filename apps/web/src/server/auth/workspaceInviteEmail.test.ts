import test from "node:test";
import assert from "node:assert/strict";
import { renderWorkspaceInviteEmail } from "./workspaceInviteEmail";

test("renderWorkspaceInviteEmail includes workspace context and CTA copy", () => {
  const result = renderWorkspaceInviteEmail({
    magicLink: "https://example.com/auth/callback?code=123",
    email: "grower@example.com",
    workspaceName: "Hope Creek Farms",
    role: "member",
    grantedByEmail: "owner@example.com",
  });

  assert.equal(
    result.subject,
    "You have access to Hope Creek Farms in NocPulse",
  );
  assert.match(result.html, /Hope Creek Farms/);
  assert.match(result.html, /owner@example\.com/);
  assert.match(result.html, /Open NocPulse/);
});
