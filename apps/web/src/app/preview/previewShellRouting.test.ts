import test from "node:test";
import assert from "node:assert/strict";

import {
  canManagePreviewFieldMutations,
  resolvePreviewCanonicalDetailInitialPage,
} from "./PreviewShell";

test("resolvePreviewCanonicalDetailInitialPage routes action to canonical actions subpage", () => {
  assert.equal(resolvePreviewCanonicalDetailInitialPage("action"), "actions");
});

test("resolvePreviewCanonicalDetailInitialPage routes notes to canonical notes subpage", () => {
  assert.equal(resolvePreviewCanonicalDetailInitialPage("notes"), "notes");
});

test("resolvePreviewCanonicalDetailInitialPage routes crops to canonical crops subpage", () => {
  assert.equal(resolvePreviewCanonicalDetailInitialPage("crops"), "crops");
});

test("resolvePreviewCanonicalDetailInitialPage leaves non-canonical panel views alone", () => {
  assert.equal(resolvePreviewCanonicalDetailInitialPage("detail"), null);
  assert.equal(resolvePreviewCanonicalDetailInitialPage("alerts"), null);
  assert.equal(resolvePreviewCanonicalDetailInitialPage("zone"), null);
});

test("canManagePreviewFieldMutations allows owners and managers only", () => {
  assert.equal(
    canManagePreviewFieldMutations(
      {
        displayName: "Owner",
        email: "owner@example.com",
        initials: "OW",
        workspaceRole: "owner",
        workspaceRoleLabel: "Owner",
        workspaceName: "Workspace",
      },
      false,
    ),
    true,
  );
  assert.equal(
    canManagePreviewFieldMutations(
      {
        displayName: "Viewer",
        email: "viewer@example.com",
        initials: "VW",
        workspaceRole: "viewer",
        workspaceRoleLabel: "Viewer",
        workspaceName: "Workspace",
      },
      false,
    ),
    false,
  );
  assert.equal(canManagePreviewFieldMutations(null, false), false);
  assert.equal(
    canManagePreviewFieldMutations(
      {
        displayName: "Manager",
        email: "manager@example.com",
        initials: "MG",
        workspaceRole: "manager",
        workspaceRoleLabel: "Manager",
        workspaceName: "Workspace",
      },
      true,
    ),
    false,
  );
});
