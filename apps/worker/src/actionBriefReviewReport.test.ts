import test from "node:test";
import assert from "node:assert/strict";
import {
  buildActionBriefReviewReport,
  resolveWorkspaceReviewerCounts,
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
    memberships: [
      { workspace_id: "w1", user_id: "user-1" },
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
  assert.equal(report.summaries[0]?.memberCount, 1);
  assert.equal(report.summaries[0]?.reviewEligible, true);
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
    memberships: [
      { workspace_id: "w1", user_id: "user-1" },
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
    reviewEligibleWorkspaceCount: 2,
    unreviewableWorkspaceCount: 0,
    totalAlertCount: 3,
    alertCount: 3,
    unreviewableAlertCount: 0,
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

test("summarizeActionBriefReviewAlerts excludes share-only workspaces from trust scoring when no reviewers exist", () => {
  const summary = summarizeActionBriefReviewAlerts(
    [
      {
        workspace_id: "share-only",
        field_id: "f1",
        status: "active",
        started_at: "2026-04-01T08:00:00.000Z",
        acknowledged_at: null,
        resolved_at: null,
        created_at: "2026-04-01T08:00:00.000Z",
        title: "Changed materially",
      },
      {
        workspace_id: "reviewable",
        field_id: "f2",
        status: "resolved",
        started_at: "2026-04-01T08:00:00.000Z",
        acknowledged_at: "2026-04-01T09:00:00.000Z",
        resolved_at: "2026-04-01T10:00:00.000Z",
        created_at: "2026-04-01T08:00:00.000Z",
        title: "Changed materially",
      },
    ],
    {
      reviewerCountByWorkspaceId: new Map([
        ["share-only", 0],
        ["reviewable", 1],
      ]),
    },
  );

  assert.deepEqual(summary, {
    workspaceCount: 2,
    reviewEligibleWorkspaceCount: 1,
    unreviewableWorkspaceCount: 1,
    totalAlertCount: 2,
    alertCount: 1,
    unreviewableAlertCount: 1,
    activeCount: 0,
    resolvedCount: 1,
    dismissedCount: 0,
    acknowledgedCount: 1,
    unacknowledgedActiveCount: 0,
    averageHoursToAcknowledge: 1,
    averageHoursToResolution: 2,
    dismissalRate: 0,
    resolutionRate: 1,
  });
});

test("resolveWorkspaceReviewerCounts excludes bootstrap placeholder users that do not resolve in auth", async () => {
  const reviewerCounts = await resolveWorkspaceReviewerCounts({
    client: {
      auth: {
        admin: {
          async getUserById(userId: string) {
            if (userId === "real-user") {
              return {
                data: {
                  user: {
                    id: userId,
                  },
                },
                error: null,
              };
            }

            return {
              data: {
                user: null,
              },
              error: new Error("user_not_found"),
            };
          },
        },
      },
    } as never,
    memberships: [
      {
        workspace_id: "w1",
        user_id: "00000000-0000-4000-8000-000000000001",
      },
      {
        workspace_id: "w1",
        user_id: "real-user",
      },
    ],
  });

  assert.equal(reviewerCounts.get("w1"), 1);
});
