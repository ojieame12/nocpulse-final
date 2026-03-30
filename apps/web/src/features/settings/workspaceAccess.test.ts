import test from "node:test";
import assert from "node:assert/strict";
import {
  canChangeWorkspaceMemberRole,
  canRemoveWorkspaceMember,
  formatWorkspaceRoleLabel,
  isValidWorkspaceAccessEmail,
  listAllowedWorkspaceMemberRoleChanges,
  listAllowedWorkspaceInviteRoles,
  normalizeWorkspaceAccessEmail,
  normalizeWorkspaceMemberRoleChange,
  normalizeWorkspaceInviteRole,
} from "./workspaceAccess";

test("owners can assign manager, member, and viewer roles", () => {
  assert.deepEqual(listAllowedWorkspaceInviteRoles("owner"), [
    "manager",
    "member",
    "viewer",
  ]);
});

test("managers can only assign member and viewer roles", () => {
  assert.deepEqual(listAllowedWorkspaceInviteRoles("manager"), [
    "member",
    "viewer",
  ]);
});

test("normalizeWorkspaceInviteRole falls back to the first allowed role", () => {
  assert.equal(normalizeWorkspaceInviteRole("owner", "manager"), "member");
  assert.equal(normalizeWorkspaceInviteRole(undefined, "owner"), "manager");
});

test("normalizeWorkspaceAccessEmail trims and lowercases emails", () => {
  assert.equal(
    normalizeWorkspaceAccessEmail("  TEAM@Example.com "),
    "team@example.com",
  );
});

test("isValidWorkspaceAccessEmail rejects malformed addresses", () => {
  assert.equal(isValidWorkspaceAccessEmail("team@example.com"), true);
  assert.equal(isValidWorkspaceAccessEmail("invalid"), false);
});

test("formatWorkspaceRoleLabel returns a readable label", () => {
  assert.equal(formatWorkspaceRoleLabel("viewer"), "Viewer");
  assert.equal(formatWorkspaceRoleLabel("owner"), "Owner");
});

test("owners can change any non-owner member role", () => {
  assert.deepEqual(
    listAllowedWorkspaceMemberRoleChanges("owner", "manager", false),
    ["manager", "member", "viewer"],
  );
  assert.deepEqual(
    listAllowedWorkspaceMemberRoleChanges("owner", "owner", false),
    [],
  );
});

test("managers can only change member and viewer roles", () => {
  assert.deepEqual(
    listAllowedWorkspaceMemberRoleChanges("manager", "member", false),
    ["member", "viewer"],
  );
  assert.deepEqual(
    listAllowedWorkspaceMemberRoleChanges("manager", "manager", false),
    [],
  );
});

test("workspace access disallows changing or removing the current actor", () => {
  assert.equal(
    canChangeWorkspaceMemberRole("owner", "member", true),
    false,
  );
  assert.equal(canRemoveWorkspaceMember("owner", "member", true), false);
});

test("normalizeWorkspaceMemberRoleChange rejects invalid transitions", () => {
  assert.equal(
    normalizeWorkspaceMemberRoleChange("manager", "manager", "member", false),
    null,
  );
  assert.equal(
    normalizeWorkspaceMemberRoleChange("viewer", "manager", "member", false),
    "viewer",
  );
});
