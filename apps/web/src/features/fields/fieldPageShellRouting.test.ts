import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveFieldPageCanonicalDetailInitialPage,
  shouldResumeFieldPageOnboardingWatch,
} from "./FieldPageShell";

test("resolveFieldPageCanonicalDetailInitialPage routes action to canonical actions subpage", () => {
  assert.equal(resolveFieldPageCanonicalDetailInitialPage("action"), "actions");
});

test("resolveFieldPageCanonicalDetailInitialPage routes notes to canonical notes subpage", () => {
  assert.equal(resolveFieldPageCanonicalDetailInitialPage("notes"), "notes");
});

test("resolveFieldPageCanonicalDetailInitialPage routes crops to canonical crops subpage", () => {
  assert.equal(resolveFieldPageCanonicalDetailInitialPage("crops"), "crops");
});

test("resolveFieldPageCanonicalDetailInitialPage leaves standalone panel views alone", () => {
  assert.equal(resolveFieldPageCanonicalDetailInitialPage("detail"), null);
  assert.equal(resolveFieldPageCanonicalDetailInitialPage("alerts"), null);
  assert.equal(resolveFieldPageCanonicalDetailInitialPage("activity"), null);
  assert.equal(resolveFieldPageCanonicalDetailInitialPage("cell"), null);
});

test("shouldResumeFieldPageOnboardingWatch resumes pending work for the same workspace", () => {
  assert.equal(
    shouldResumeFieldPageOnboardingWatch(
      {
        workspaceId: "workspace-1",
        preferredFieldId: "field-1",
        fieldIds: ["field-1"],
        dispatchIds: ["dispatch-1"],
      },
      "workspace-1",
    ),
    true,
  );
});

test("shouldResumeFieldPageOnboardingWatch ignores empty or foreign-workspace watches", () => {
  assert.equal(
    shouldResumeFieldPageOnboardingWatch(
      {
        workspaceId: "workspace-1",
        preferredFieldId: "field-1",
        fieldIds: ["field-1"],
        dispatchIds: [],
      },
      "workspace-1",
    ),
    false,
  );
  assert.equal(
    shouldResumeFieldPageOnboardingWatch(
      {
        workspaceId: "workspace-1",
        preferredFieldId: "field-1",
        fieldIds: ["field-1"],
        dispatchIds: ["dispatch-1"],
      },
      "workspace-2",
    ),
    false,
  );
});
