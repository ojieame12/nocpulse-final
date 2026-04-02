import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { SettingsPanel } from "../SettingsPanel";

function createViewer(role: "owner" | "manager" | "member" | "viewer") {
  return {
    displayName: "Nora Admin",
    email: "nora@example.com",
    initials: "NA",
    workspaceRole: role,
    workspaceRoleLabel: role[0].toUpperCase() + role.slice(1),
    workspaceName: "Hope Creek",
  } as const;
}

test("SettingsPanel shows archived field management for managers", () => {
  const markup = renderToStaticMarkup(
    <SettingsPanel
      workspaceId="workspace-1"
      viewer={createViewer("manager")}
    />,
  );

  assert.match(markup, /ARCHIVED FIELDS/);
  assert.match(markup, /Loading archived field history/);
});

test("SettingsPanel hides archived field management for non-managers", () => {
  const markup = renderToStaticMarkup(
    <SettingsPanel
      workspaceId="workspace-1"
      viewer={createViewer("member")}
    />,
  );

  assert.doesNotMatch(markup, /ARCHIVED FIELDS/);
});
