import test from "node:test";
import assert from "node:assert/strict";
import {
  createOfflineScoutNoteRecord,
  type OfflineScoutNotePayload,
} from "./offlineScoutNotesQueue";

const payload: OfflineScoutNotePayload = {
  outcome: "confirmed",
  noteText: "Stress still visible near the low spot.",
  findingId: "finding-1",
  zoneId: "zone-1",
  cellKey: "cell-1",
  observedAt: null,
};

test("createOfflineScoutNoteRecord keeps the field submission payload", () => {
  const record = createOfflineScoutNoteRecord({
    fieldId: "field-1",
    workspaceId: "workspace-1",
    submitUrl: "/api/fields/field-1/notes",
    payload,
  });

  assert.equal(record.fieldId, "field-1");
  assert.equal(record.workspaceId, "workspace-1");
  assert.equal(record.submitUrl, "/api/fields/field-1/notes");
  assert.equal(record.payload.noteText, payload.noteText);
  assert.equal(record.syncStatus, "pending");
  assert.equal(record.attemptCount, 0);
  assert.ok(record.id.length > 0);
});
