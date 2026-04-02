import test from "node:test";
import assert from "node:assert/strict";
import { buildFirstInsightFollowupReport } from "./firstInsightFollowupReport";

test("buildFirstInsightFollowupReport classifies missing field activity after grant", () => {
  const report = buildFirstInsightFollowupReport({
    generatedAt: "2026-04-02T12:00:00.000Z",
    funnel: {
      generatedAt: "2026-04-02T12:00:00.000Z",
      requestCount: 1,
      grantedCount: 1,
      firstFieldActivityCount: 0,
      firstInsightCount: 0,
      averageHoursToGrant: 1,
      averageHoursToFirstFieldActivity: null,
      averageHoursToFirstInsight: null,
      dailyCounts: [],
      rows: [{
        requestId: "r1",
        email: "grower@example.com",
        farmName: "Farm",
        requestStatus: "reviewed",
        submittedAt: "2026-04-01T08:00:00.000Z",
        grantedAt: "2026-04-01T10:00:00.000Z",
        workspaceId: "w1",
        firstFieldActivityAt: null,
        firstFieldActivityType: null,
        firstInsightAt: null,
        reachedFirstInsight: false,
      }],
    },
    launchVisibleByWorkspaceId: new Map(),
  });

  assert.equal(report.followupCount, 1);
  assert.equal(report.rows[0]?.followupReason, "field-activity-missing");
});

test("buildFirstInsightFollowupReport flags weak launch-visible curation before insight follow-up", () => {
  const report = buildFirstInsightFollowupReport({
    generatedAt: "2026-04-02T12:00:00.000Z",
    funnel: {
      generatedAt: "2026-04-02T12:00:00.000Z",
      requestCount: 1,
      grantedCount: 1,
      firstFieldActivityCount: 1,
      firstInsightCount: 0,
      averageHoursToGrant: 1,
      averageHoursToFirstFieldActivity: 2,
      averageHoursToFirstInsight: null,
      dailyCounts: [],
      rows: [{
        requestId: "r1",
        email: "grower@example.com",
        farmName: "Farm",
        requestStatus: "reviewed",
        submittedAt: "2026-04-01T08:00:00.000Z",
        grantedAt: "2026-04-01T10:00:00.000Z",
        workspaceId: "w1",
        firstFieldActivityAt: "2026-04-01T12:00:00.000Z",
        firstFieldActivityType: "field.created",
        firstInsightAt: null,
        reachedFirstInsight: false,
      }],
    },
    launchVisibleByWorkspaceId: new Map([
      ["w1", { scopedFieldCount: 5, readyCount: 1, hasEnoughReadyFields: false }],
    ]),
  });

  assert.equal(report.rows[0]?.followupReason, "launch-visible-weak");
});

test("buildFirstInsightFollowupReport uses insight-missing when launch-visible fields are strong but insight still never surfaced", () => {
  const report = buildFirstInsightFollowupReport({
    generatedAt: "2026-04-02T12:00:00.000Z",
    funnel: {
      generatedAt: "2026-04-02T12:00:00.000Z",
      requestCount: 1,
      grantedCount: 1,
      firstFieldActivityCount: 1,
      firstInsightCount: 0,
      averageHoursToGrant: 1,
      averageHoursToFirstFieldActivity: 2,
      averageHoursToFirstInsight: null,
      dailyCounts: [],
      rows: [{
        requestId: "r1",
        email: "grower@example.com",
        farmName: "Farm",
        requestStatus: "reviewed",
        submittedAt: "2026-04-01T08:00:00.000Z",
        grantedAt: "2026-04-01T10:00:00.000Z",
        workspaceId: "w1",
        firstFieldActivityAt: "2026-04-01T12:00:00.000Z",
        firstFieldActivityType: "field.created",
        firstInsightAt: null,
        reachedFirstInsight: false,
      }],
    },
    launchVisibleByWorkspaceId: new Map([
      ["w1", { scopedFieldCount: 5, readyCount: 3, hasEnoughReadyFields: true }],
    ]),
  });

  assert.equal(report.rows[0]?.followupReason, "insight-missing");
});
