import test from "node:test";
import assert from "node:assert/strict";
import { buildImagerySyncReport } from "./buildImagerySyncReport";
import type { ImageryCapture } from "../contracts/ImageryCapture";

function createCapture(
  overrides: Partial<ImageryCapture> & {
    id: string;
    workspaceId: string;
    fieldId: string;
    requestedAt: string;
    capturedAt: string;
    providerKey: "sentinel-2" | "planet" | "sentinel-1";
    status: "dry-run" | "discovered" | "materialized" | "unavailable";
  },
): ImageryCapture {
  return {
    id: overrides.id,
    workspaceId: overrides.workspaceId,
    fieldId: overrides.fieldId,
    requestedAt: overrides.requestedAt,
    capturedAt: overrides.capturedAt,
    providerKey: overrides.providerKey,
    sceneKey: overrides.sceneKey ?? `${overrides.providerKey}-${overrides.id}`,
    status: overrides.status,
    coveragePct: overrides.coveragePct ?? 100,
    cloudCoverPct: overrides.cloudCoverPct ?? null,
    note: overrides.note ?? null,
    metadata: overrides.metadata ?? {},
    observationId: overrides.observationId ?? null,
    createdAt: overrides.createdAt ?? overrides.requestedAt,
  };
}

test("buildImagerySyncReport summarizes recent captures and classifies stale fields from latest captures", () => {
  const report = buildImagerySyncReport({
    generatedAt: "2026-03-28T07:10:00.000Z",
    createdAfter: "2026-03-28T06:00:00.000Z",
    staleBefore: "2026-03-27T07:10:00.000Z",
    recentCaptures: [
      createCapture({
        id: "cap-1",
        workspaceId: "workspace-1",
        fieldId: "field-1",
        requestedAt: "2026-03-28T06:15:00.000Z",
        capturedAt: "2026-03-24T13:39:13.000Z",
        providerKey: "sentinel-1",
        status: "materialized",
      }),
      createCapture({
        id: "cap-2",
        workspaceId: "workspace-1",
        fieldId: "field-2",
        requestedAt: "2026-03-28T06:20:00.000Z",
        capturedAt: "2026-03-25T04:45:46.000Z",
        providerKey: "sentinel-2",
        status: "materialized",
      }),
      createCapture({
        id: "cap-3",
        workspaceId: "workspace-1",
        fieldId: "field-2",
        requestedAt: "2026-03-28T06:40:00.000Z",
        capturedAt: "2026-03-26T18:03:29.000Z",
        providerKey: "planet",
        status: "unavailable",
      }),
    ],
    latestCaptures: [
      createCapture({
        id: "latest-1",
        workspaceId: "workspace-1",
        fieldId: "field-1",
        requestedAt: "2026-03-28T06:15:00.000Z",
        capturedAt: "2026-03-24T13:39:13.000Z",
        providerKey: "sentinel-1",
        status: "materialized",
      }),
      createCapture({
        id: "latest-2",
        workspaceId: "workspace-1",
        fieldId: "field-2",
        requestedAt: "2026-03-28T06:40:00.000Z",
        capturedAt: "2026-03-26T18:03:29.000Z",
        providerKey: "planet",
        status: "unavailable",
      }),
      createCapture({
        id: "latest-3",
        workspaceId: "workspace-1",
        fieldId: "field-3",
        requestedAt: "2026-03-26T06:00:00.000Z",
        capturedAt: "2026-03-20T08:00:00.000Z",
        providerKey: "sentinel-2",
        status: "materialized",
      }),
    ],
    fields: [
      { workspaceId: "workspace-1", fieldId: "field-1" },
      { workspaceId: "workspace-1", fieldId: "field-2" },
      { workspaceId: "workspace-1", fieldId: "field-3" },
      { workspaceId: "workspace-1", fieldId: "field-4" },
    ],
    fieldLabelsById: {
      "field-1": {
        workspaceName: "FieldPulse Dev Farm",
        workspaceSlug: "fieldpulse-dev-farm",
        fieldName: "North Quarter Demo",
      },
      "field-2": {
        workspaceName: "FieldPulse Dev Farm",
        workspaceSlug: "fieldpulse-dev-farm",
        fieldName: "Batch North 066039",
      },
      "field-3": {
        workspaceName: "FieldPulse Dev Farm",
        workspaceSlug: "fieldpulse-dev-farm",
        fieldName: "Batch South 066039",
      },
      "field-4": {
        workspaceName: "FieldPulse Dev Farm",
        workspaceSlug: "fieldpulse-dev-farm",
        fieldName: "West Ridge",
      },
    },
  });

  assert.equal(report.generatedAt, "2026-03-28T07:10:00.000Z");
  assert.equal(report.createdAfter, "2026-03-28T06:00:00.000Z");
  assert.equal(report.scannedCaptureCount, 3);
  assert.equal(report.refreshedFieldCount, 2);
  assert.equal(report.materializedFieldCount, 2);
  assert.equal(report.unavailableFieldCount, 1);
  assert.equal(report.staleFieldCount, 3);

  assert.deepEqual(report.workspaceSummaries, [
    {
      workspaceId: "workspace-1",
      workspaceName: "FieldPulse Dev Farm",
      workspaceSlug: "fieldpulse-dev-farm",
      providerKey: "planet",
      captureCount: 1,
      refreshedFieldCount: 1,
      materializedFieldCount: 0,
      unavailableFieldCount: 1,
      latestRequestedAt: "2026-03-28T06:40:00.000Z",
      latestCapturedAt: "2026-03-26T18:03:29.000Z",
    },
    {
      workspaceId: "workspace-1",
      workspaceName: "FieldPulse Dev Farm",
      workspaceSlug: "fieldpulse-dev-farm",
      providerKey: "sentinel-1",
      captureCount: 1,
      refreshedFieldCount: 1,
      materializedFieldCount: 1,
      unavailableFieldCount: 0,
      latestRequestedAt: "2026-03-28T06:15:00.000Z",
      latestCapturedAt: "2026-03-24T13:39:13.000Z",
    },
    {
      workspaceId: "workspace-1",
      workspaceName: "FieldPulse Dev Farm",
      workspaceSlug: "fieldpulse-dev-farm",
      providerKey: "sentinel-2",
      captureCount: 1,
      refreshedFieldCount: 1,
      materializedFieldCount: 1,
      unavailableFieldCount: 0,
      latestRequestedAt: "2026-03-28T06:20:00.000Z",
      latestCapturedAt: "2026-03-25T04:45:46.000Z",
    },
  ]);

  assert.deepEqual(report.fieldIssues, [
    {
      workspaceId: "workspace-1",
      workspaceName: "FieldPulse Dev Farm",
      workspaceSlug: "fieldpulse-dev-farm",
      fieldId: "field-4",
      fieldName: "West Ridge",
      lastRequestedAt: null,
      lastCapturedAt: null,
      lastProviderKey: null,
      lastStatus: null,
      issueType: "missing-imagery",
    },
    {
      workspaceId: "workspace-1",
      workspaceName: "FieldPulse Dev Farm",
      workspaceSlug: "fieldpulse-dev-farm",
      fieldId: "field-3",
      fieldName: "Batch South 066039",
      lastRequestedAt: "2026-03-26T06:00:00.000Z",
      lastCapturedAt: "2026-03-20T08:00:00.000Z",
      lastProviderKey: "sentinel-2",
      lastStatus: "materialized",
      issueType: "stale-imagery",
    },
    {
      workspaceId: "workspace-1",
      workspaceName: "FieldPulse Dev Farm",
      workspaceSlug: "fieldpulse-dev-farm",
      fieldId: "field-2",
      fieldName: "Batch North 066039",
      lastRequestedAt: "2026-03-28T06:40:00.000Z",
      lastCapturedAt: "2026-03-26T18:03:29.000Z",
      lastProviderKey: "planet",
      lastStatus: "unavailable",
      issueType: "unavailable-imagery",
    },
  ]);
});

test("buildImagerySyncReport sorts stale issues by most recent request within the same issue type", () => {
  const report = buildImagerySyncReport({
    staleBefore: "2026-03-27T07:10:00.000Z",
    recentCaptures: [],
    latestCaptures: [
      createCapture({
        id: "latest-a",
        workspaceId: "workspace-1",
        fieldId: "field-a",
        requestedAt: "2026-03-26T08:00:00.000Z",
        capturedAt: "2026-03-20T08:00:00.000Z",
        providerKey: "sentinel-2",
        status: "materialized",
      }),
      createCapture({
        id: "latest-b",
        workspaceId: "workspace-1",
        fieldId: "field-b",
        requestedAt: "2026-03-26T12:00:00.000Z",
        capturedAt: "2026-03-21T08:00:00.000Z",
        providerKey: "sentinel-1",
        status: "materialized",
      }),
    ],
    fields: [
      { workspaceId: "workspace-1", fieldId: "field-a" },
      { workspaceId: "workspace-1", fieldId: "field-b" },
    ],
    fieldLabelsById: {
      "field-a": { fieldName: "Older stale field" },
      "field-b": { fieldName: "Newer stale field" },
    },
  });

  assert.equal(report.fieldIssues.length, 2);
  assert.equal(report.fieldIssues[0]?.fieldId, "field-b");
  assert.equal(report.fieldIssues[1]?.fieldId, "field-a");
});
