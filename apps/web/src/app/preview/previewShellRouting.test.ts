import test from "node:test";
import assert from "node:assert/strict";

import { resolvePreviewCanonicalDetailInitialPage } from "./PreviewShell";

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
