import test from "node:test";
import assert from "node:assert/strict";

import {
  applySuggestedFieldName,
  resolveAddFieldPrimaryLabel,
  resolveAddFieldProgressCopy,
} from "../addFieldPanelFlow.shared";

test("applySuggestedFieldName only fills blank field names", () => {
  assert.equal(applySuggestedFieldName("", "North Quarter"), "North Quarter");
  assert.equal(
    applySuggestedFieldName("Existing Name", "North Quarter"),
    "Existing Name",
  );
  assert.equal(applySuggestedFieldName("   ", "  North Quarter  "), "North Quarter");
});

test("resolveAddFieldPrimaryLabel uses submit phases for csv save and commit", () => {
  assert.equal(
    resolveAddFieldPrimaryLabel({
      isRetryingHydration: false,
      isSubmitting: true,
      method: "csv",
      lldDraftReady: false,
      boundaryDraftReady: false,
      spreadsheetPreviewFieldCount: 12,
      activeSubmitPhase: "csv-save",
    }),
    "Importing",
  );

  assert.equal(
    resolveAddFieldPrimaryLabel({
      isRetryingHydration: false,
      isSubmitting: false,
      method: "csv",
      lldDraftReady: false,
      boundaryDraftReady: false,
      spreadsheetPreviewFieldCount: 12,
      activeSubmitPhase: null,
    }),
    "Import 12 Fields",
  );
});

test("resolveAddFieldProgressCopy explains saved batch resume during csv import", () => {
  const saveCopy = resolveAddFieldProgressCopy({
    activeSubmitPhase: "csv-save",
    retryingHydrationFieldLabel: null,
    spreadsheetPreviewFieldCount: 8,
  });
  assert.ok(saveCopy);
  assert.match(saveCopy.title, /saving the validated import batch/i);
  assert.match(saveCopy.detail, /resume without re-uploading/i);

  const commitCopy = resolveAddFieldProgressCopy({
    activeSubmitPhase: "csv-commit",
    retryingHydrationFieldLabel: null,
    spreadsheetPreviewFieldCount: 8,
  });
  assert.ok(commitCopy);
  assert.match(commitCopy.detail, /Importing 8 fields/i);
});
