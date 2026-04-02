import assert from "node:assert/strict";
import test from "node:test";

import {
  mergeResolvedSidebarField,
  resolveCompletedImportedFieldIds,
} from "./progressiveFieldStrip.shared";

test("mergeResolvedSidebarField appends completed fields that were not visible yet", () => {
  const merged = mergeResolvedSidebarField(
    [
      {
        id: "field-a",
        name: "Alpha",
        area: "64 ha",
        status: "healthy",
      },
    ],
    {
      id: "field-b",
      name: "Bravo",
      area: "80 ha",
      status: "warning",
    },
  );

  assert.deepEqual(
    merged.map((field) => field.id),
    ["field-a", "field-b"],
  );
  assert.equal(merged[1]?.name, "Bravo");
});

test("mergeResolvedSidebarField replaces an existing field without duplicating it", () => {
  const merged = mergeResolvedSidebarField(
    [
      {
        id: "field-a",
        name: "Alpha",
        area: "Queued",
        status: "pending",
      },
    ],
    {
      id: "field-a",
      name: "Alpha",
      area: "64 ha",
      status: "healthy",
    },
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.area, "64 ha");
  assert.equal(merged[0]?.status, "healthy");
});

test("resolveCompletedImportedFieldIds returns only newly completed field ids", () => {
  const completedFieldIds = resolveCompletedImportedFieldIds({
    dispatchFieldMap: new Map([
      ["dispatch-1", { fieldId: "field-a", fieldLabel: "Alpha" }],
      ["dispatch-2", { fieldId: "field-b", fieldLabel: "Bravo" }],
      ["dispatch-3", { fieldId: "field-c", fieldLabel: "Charlie" }],
    ]),
    onboardingStatuses: new Map([
      ["dispatch-1", { status: "completed", fieldId: "field-a" }],
      ["dispatch-2", { status: "running", fieldId: "field-b" }],
      ["dispatch-3", { status: "completed", fieldId: null }],
    ]),
    syncedFieldIds: new Set(["field-c"]),
  });

  assert.deepEqual(completedFieldIds, ["field-a"]);
});
