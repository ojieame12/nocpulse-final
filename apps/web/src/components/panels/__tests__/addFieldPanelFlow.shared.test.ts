import test from "node:test";
import assert from "node:assert/strict";

import {
  applySuggestedFieldName,
  buildSavedSpreadsheetBatchResume,
  parseSavedSpreadsheetBatchResume,
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

test("saved spreadsheet batch resume round-trips through storage", () => {
  const resume = buildSavedSpreadsheetBatchResume({
    workspaceId: "workspace-1",
    batchId: "batch-1",
    fileName: "import.xlsx",
    sheetName: "Sheet1",
    rowCount: 32,
    fieldCount: 8,
    issueCount: 1,
    savedAt: "2026-04-02T17:00:00.000Z",
  });

  assert.deepEqual(
    parseSavedSpreadsheetBatchResume(JSON.stringify(resume)),
    resume,
  );
  assert.equal(parseSavedSpreadsheetBatchResume("{"), null);
});
