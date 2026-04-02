import test from "node:test";
import assert from "node:assert/strict";
import {
  buildActionBriefReviewReport,
  summarizeActionBriefReviewAlerts,
} from "./actionBriefReviewReport";

test("buildActionBriefReviewReport summarizes action brief outcomes by workspace", () => {
  const report = buildActionBriefReviewReport({
    generatedAt: "2026-04-02T12:00:00.000Z",
    workspaceFilter: null,
    lookbackDays: 30,
    workspaces: [
      { id: "w1", slug: "hope-creek", name: "Hope Creek" },
    ],
    alerts: [
      {
        workspace_id: "w1",
        field_id: "f1",
        status: "active",
        started_at: "2026-04-01T08:00:00.000Z",
        acknowledged_at: null,
        resolved_at: null,
        created_at: "2026-04-01T08:00:00.000Z",
        title: "Changed materially",
      },
      {
        workspace_id: "w1",
        field_id: "f2",
        status: "resolved",
        started_at: "2026-04-01T08:00:00.000Z",
        acknowledged_at: "2026-04-01T09:00:00.000Z",
        resolved_at: "2026-04-01T10:00:00.000Z",
        created_at: "2026-04-01T08:00:00.000Z",
        title: "Changed materially",
      },
      {
        workspace_id: "w1",
        field_id: "f3",
        status: "dismissed",
        started_at: "2026-04-01T08:00:00.000Z",
        acknowledged_at: "2026-04-01T08:30:00.000Z",
        resolved_at: "2026-04-01T09:00:00.000Z",
        created_at: "2026-04-01T08:00:00.000Z",
        title: "Changed materially",
      },
    ],
  });

  assert.equal(report.workspaceCount, 1);
  assert.equal(report.summaries[0]?.activeCount, 1);
  assert.equal(report.summaries[0]?.resolvedCount, 1);
  assert.equal(report.summaries[0]?.dismissedCount, 1);
  assert.equal(report.summaries[0]?.acknowledgedCount, 2);
  assert.equal(report.summaries[0]?.unacknowledgedActiveCount, 1);
});

test("buildActionBriefReviewReport computes average acknowledge and resolution times", () => {
  const report = buildActionBriefReviewReport({
    generatedAt: "2026-04-02T12:00:00.000Z",
    workspaceFilter: "hope-creek",
    lookbackDays: 30,
    workspaces: [
      { id: "w1", slug: "hope-creek", name: "Hope Creek" },
    ],
    alerts: [
      {
        workspace_id: "w1",
        field_id: "f1",
        status: "resolved",
        started_at: "2026-04-01T08:00:00.000Z",
        acknowledged_at: "2026-04-01T10:00:00.000Z",
        resolved_at: "2026-04-01T12:00:00.000Z",
        created_at: "2026-04-01T08:00:00.000Z",
        title: "Changed materially",
      },
      {
        workspace_id: "w1",
        field_id: "f2",
        status: "dismissed",
        started_at: "2026-04-01T09:00:00.000Z",
        acknowledged_at: "2026-04-01T10:00:00.000Z",
        resolved_at: "2026-04-01T11:00:00.000Z",
        created_at: "2026-04-01T09:00:00.000Z",
        title: "Changed materially",
      },
    ],
  });

  assert.equal(report.summaries[0]?.averageHoursToAcknowledge, 1.5);
  assert.equal(report.summaries[0]?.averageHoursToResolution, 3);
});

test("summarizeActionBriefReviewAlerts aggregates trust metrics across alerts", () => {
  const summary = summarizeActionBriefReviewAlerts([
    {
      workspace_id: "w1",
      field_id: "f1",
      status: "active",
      started_at: "2026-04-01T08:00:00.000Z",
      acknowledged_at: null,
      resolved_at: null,
      created_at: "2026-04-01T08:00:00.000Z",
      title: "Changed materially",
    },
    {
      workspace_id: "w1",
      field_id: "f2",
      status: "resolved",
      started_at: "2026-04-01T08:00:00.000Z",
      acknowledged_at: "2026-04-01T10:00:00.000Z",
      resolved_at: "2026-04-01T12:00:00.000Z",
      created_at: "2026-04-01T08:00:00.000Z",
      title: "Changed materially",
    },
    {
      workspace_id: "w2",
      field_id: "f3",
      status: "dismissed",
      started_at: "2026-04-01T09:00:00.000Z",
      acknowledged_at: "2026-04-01T10:00:00.000Z",
      resolved_at: "2026-04-01T11:00:00.000Z",
      created_at: "2026-04-01T09:00:00.000Z",
      title: "Changed materially",
    },
  ]);

  assert.deepEqual(summary, {
    workspaceCount: 2,
    alertCount: 3,
    activeCount: 1,
    resolvedCount: 1,
    dismissedCount: 1,
    acknowledgedCount: 2,
    unacknowledgedActiveCount: 1,
    averageHoursToAcknowledge: 1.5,
    averageHoursToResolution: 3,
    dismissalRate: 0.3333,
    resolutionRate: 0.3333,
  });
});
