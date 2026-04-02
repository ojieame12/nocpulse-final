import test from "node:test";
import assert from "node:assert/strict";
import { buildFirstInsightFunnelReport } from "./firstInsightFunnelReport.shared";

test("buildFirstInsightFunnelReport stitches request, grant, field activity, and first insight", () => {
  const report = buildFirstInsightFunnelReport({
    generatedAt: "2026-04-02T09:00:00.000Z",
    requests: [
      {
        id: "request-1",
        email: "grower@example.com",
        farmName: "Hope Creek",
        status: "contacted",
        createdAt: "2026-04-01T08:00:00.000Z",
      },
      {
        id: "request-2",
        email: "slow@example.com",
        farmName: "Slow Farm",
        status: "new",
        createdAt: "2026-04-01T10:00:00.000Z",
      },
    ],
    auditEvents: [
      {
        action: "request-access.granted",
        workspaceId: "workspace-1",
        resourceId: "request-1",
        createdAt: "2026-04-01T09:00:00.000Z",
        metadata: {
          createdWorkspaceId: "workspace-1",
        },
      },
      {
        action: "field-import.batch_committed",
        workspaceId: "workspace-1",
        resourceId: "batch-1",
        createdAt: "2026-04-01T09:30:00.000Z",
        metadata: {},
      },
      {
        action: "preview.first_insight_surfaced",
        workspaceId: "workspace-1",
        resourceId: "field-1",
        createdAt: "2026-04-01T10:00:00.000Z",
        metadata: {},
      },
    ],
  });

  assert.equal(report.requestCount, 2);
  assert.equal(report.grantedCount, 1);
  assert.equal(report.firstFieldActivityCount, 1);
  assert.equal(report.firstInsightCount, 1);
  assert.equal(report.averageHoursToGrant, 1);
  assert.equal(report.averageHoursToFirstFieldActivity, 0.5);
  assert.equal(report.averageHoursToFirstInsight, 1);
  assert.equal(report.rows[0]?.requestId, "request-2");
  assert.equal(report.rows[1]?.requestId, "request-1");
  assert.equal(report.rows[1]?.workspaceId, "workspace-1");
  assert.equal(report.rows[1]?.firstFieldActivityType, "field-import.batch_committed");
  assert.equal(report.rows[1]?.reachedFirstInsight, true);
});

test("buildFirstInsightFunnelReport falls back to metadata workspace ids on grant events", () => {
  const report = buildFirstInsightFunnelReport({
    requests: [
      {
        id: "request-1",
        email: "grower@example.com",
        farmName: "Hope Creek",
        status: "contacted",
        createdAt: "2026-04-01T08:00:00.000Z",
      },
    ],
    auditEvents: [
      {
        action: "request-access.granted",
        workspaceId: null,
        resourceId: "request-1",
        createdAt: "2026-04-01T09:00:00.000Z",
        metadata: {
          createdWorkspaceId: "workspace-1",
        },
      },
      {
        action: "field.created",
        workspaceId: "workspace-1",
        resourceId: "field-1",
        createdAt: "2026-04-01T09:15:00.000Z",
        metadata: {},
      },
    ],
  });

  assert.equal(report.rows[0]?.workspaceId, "workspace-1");
  assert.equal(report.rows[0]?.firstFieldActivityType, "field.created");
});
