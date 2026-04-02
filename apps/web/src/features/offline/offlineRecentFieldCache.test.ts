import test from "node:test";
import assert from "node:assert/strict";
import {
  buildOfflineCacheOwnerKey,
  createOfflineFieldSnapshotRecord,
  listPrunableOfflineSnapshotKeys,
} from "./offlineRecentFieldCache";

test("buildOfflineCacheOwnerKey returns null for guest sessions", () => {
  assert.equal(
    buildOfflineCacheOwnerKey({
      workspaceId: "workspace-1",
      viewer: {
        displayName: "Nora Admin",
        email: "nora@example.com",
        initials: "NA",
        workspaceRole: "manager",
        workspaceRoleLabel: "Manager",
        workspaceName: "Hope Creek",
      },
      isGuestSession: true,
    }),
    null,
  );
});

test("buildOfflineCacheOwnerKey prefers normalized viewer email", () => {
  assert.equal(
    buildOfflineCacheOwnerKey({
      workspaceId: "workspace-1",
      viewer: {
        displayName: "Nora Admin",
        email: " Nora@Example.com ",
        initials: "NA",
        workspaceRole: "manager",
        workspaceRoleLabel: "Manager",
        workspaceName: "Hope Creek",
      },
      isGuestSession: false,
    }),
    "nora@example.com:workspace-1",
  );
});

test("listPrunableOfflineSnapshotKeys trims older offline snapshots", () => {
  const baseField = {
    workspaceId: "workspace-1",
    fieldId: "field-1",
    fieldName: "North",
    areaHaLabel: "12.3 ha",
    cropContext: null,
    mapPreview: {
      fieldId: "field-1",
      fieldName: "North",
      bbox: [0, 0, 0, 0],
      labelPoint: [0, 0],
      boundaryFeature: {
        type: "Feature",
        properties: { fieldId: "field-1", fieldName: "North" },
        geometry: { type: "MultiPolygon", coordinates: [] },
      },
      agronomicSurface: null,
      presentation: {
        viewportPaddingPx: 60,
      },
    },
    sidebarFields: [],
    summary: null,
    reportPanel: null,
    actionPanel: null,
    notesPanel: null,
    marketPanel: null,
    cropPanel: null,
    alertsPanel: null,
    activityPanel: null,
    cellInspector: null,
  } as const;

  const records = [
    createOfflineFieldSnapshotRecord("owner", { ...baseField, fieldId: "field-1" }),
    createOfflineFieldSnapshotRecord("owner", { ...baseField, fieldId: "field-2", fieldName: "South" }),
    createOfflineFieldSnapshotRecord("owner", { ...baseField, fieldId: "field-3", fieldName: "East" }),
  ].map((record, index) => ({
    ...record,
    savedAt: `2026-04-0${index + 1}T12:00:00.000Z`,
  }));

  assert.deepEqual(listPrunableOfflineSnapshotKeys(records, 2), ["owner:field-1"]);
});
