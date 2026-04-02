import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPreviewFirstInsightReport,
  type PreviewFirstInsightEvent,
} from "./previewFirstInsightReport.shared";

const HOPE_CREEK_WORKSPACE_ID = "8f2afceb-aefe-4e90-a24e-7ab07c4423fe";

function makeEvent(
  overrides: Partial<PreviewFirstInsightEvent> = {},
): PreviewFirstInsightEvent {
  return {
    createdAt: "2026-04-02T05:00:00.000Z",
    actorUserId: "user-1",
    workspaceId: HOPE_CREEK_WORKSPACE_ID,
    fieldId: "field-main",
    fieldName: "Main Farm",
    dataQualityLabel: "Ready",
    moistureConfidenceLevel: "high",
    moistureDerivationMode: "source-backed",
    workspaceSummaryComparisonCount: 3,
    focusFieldId: "field-main",
    focusFieldName: "Main Farm",
    ...overrides,
  };
}

test("buildPreviewFirstInsightReport summarizes counts and allowlisted focus fields", () => {
  const report = buildPreviewFirstInsightReport({
    workspaceFilter: HOPE_CREEK_WORKSPACE_ID,
    workspaceId: HOPE_CREEK_WORKSPACE_ID,
    workspaceSlug: "hope-creek-farms",
    lookbackDays: 7,
    events: [
      makeEvent(),
      makeEvent({
        createdAt: "2026-04-02T05:10:00.000Z",
        actorUserId: "user-2",
      }),
      makeEvent({
        createdAt: "2026-04-01T05:10:00.000Z",
        actorUserId: "user-1",
        fieldId: "field-rath",
        fieldName: "Rath",
        focusFieldId: "field-rath",
        focusFieldName: "Rath",
      }),
      makeEvent({
        createdAt: "2026-04-01T06:10:00.000Z",
        actorUserId: "user-3",
        fieldId: "field-zeta",
        fieldName: "Zeta North",
        focusFieldId: "field-zeta",
        focusFieldName: "Zeta North",
      }),
    ],
  });

  assert.equal(report.eventCount, 4);
  assert.equal(report.uniqueActorCount, 3);
  assert.equal(report.uniqueFieldCount, 3);
  assert.equal(report.allowlistedEventCount, 3);
  assert.equal(report.nonAllowlistedEventCount, 1);
  assert.equal(report.averageWorkspaceSummaryComparisonCount, 3);
  assert.deepEqual(report.daily, [
    {
      date: "2026-04-01",
      eventCount: 2,
      uniqueActorCount: 2,
      uniqueFieldCount: 2,
    },
    {
      date: "2026-04-02",
      eventCount: 2,
      uniqueActorCount: 2,
      uniqueFieldCount: 1,
    },
  ]);
  assert.deepEqual(report.topFields[0], {
    fieldId: "field-main",
    fieldName: "Main Farm",
    eventCount: 2,
    uniqueActorCount: 2,
    firstSeenAt: "2026-04-02T05:00:00.000Z",
    lastSeenAt: "2026-04-02T05:10:00.000Z",
    allowlisted: true,
  });
  assert.equal(report.topFields[2]?.allowlisted, false);
  assert.equal(report.recentEvents[0]?.focusFieldName, "Main Farm");
});

test("buildPreviewFirstInsightReport handles empty input", () => {
  const report = buildPreviewFirstInsightReport({
    workspaceFilter: null,
    workspaceId: null,
    workspaceSlug: null,
    lookbackDays: 7,
    events: [],
  });

  assert.equal(report.eventCount, 0);
  assert.equal(report.uniqueActorCount, 0);
  assert.equal(report.uniqueFieldCount, 0);
  assert.equal(report.allowlistedEventCount, 0);
  assert.equal(report.nonAllowlistedEventCount, 0);
  assert.equal(report.averageWorkspaceSummaryComparisonCount, null);
  assert.deepEqual(report.daily, []);
  assert.deepEqual(report.topFields, []);
  assert.deepEqual(report.recentEvents, []);
});
