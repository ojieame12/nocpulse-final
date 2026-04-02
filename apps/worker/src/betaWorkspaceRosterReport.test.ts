import test from "node:test";
import assert from "node:assert/strict";
import { buildBetaWorkspaceRosterReport } from "./betaWorkspaceRosterReport";

test("buildBetaWorkspaceRosterReport marks granted workspaces without activity as needs-intake", () => {
  const report = buildBetaWorkspaceRosterReport({
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
    workspaceById: new Map([
      ["w1", { id: "w1", slug: "hope-creek", name: "Hope Creek" }],
    ]),
  });

  assert.equal(report.rows[0]?.status, "needs-intake");
  assert.equal(report.rows[0]?.workspaceSlug, "hope-creek");
  assert.equal(report.rows[0]?.workspaceName, "Hope Creek");
  assert.equal(report.statusCounts["needs-intake"], 1);
});

test("buildBetaWorkspaceRosterReport marks workspaces with weak launch-visible fields as needs-curation", () => {
  const report = buildBetaWorkspaceRosterReport({
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
    workspaceById: new Map([
      ["w1", { id: "w1", slug: "hope-creek", name: "Hope Creek" }],
    ]),
  });

  assert.equal(report.rows[0]?.status, "needs-curation");
  assert.equal(report.rows[0]?.workspaceName, "Hope Creek");
  assert.equal(report.statusCounts["needs-curation"], 1);
});

test("buildBetaWorkspaceRosterReport marks insight-complete workspaces as ready-for-outreach", () => {
  const report = buildBetaWorkspaceRosterReport({
    generatedAt: "2026-04-02T12:00:00.000Z",
    funnel: {
      generatedAt: "2026-04-02T12:00:00.000Z",
      requestCount: 1,
      grantedCount: 1,
      firstFieldActivityCount: 1,
      firstInsightCount: 1,
      averageHoursToGrant: 1,
      averageHoursToFirstFieldActivity: 2,
      averageHoursToFirstInsight: 3,
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
        firstInsightAt: "2026-04-01T14:00:00.000Z",
        reachedFirstInsight: true,
      }],
    },
    launchVisibleByWorkspaceId: new Map([
      ["w1", { scopedFieldCount: 5, readyCount: 3, hasEnoughReadyFields: true }],
    ]),
    workspaceById: new Map([
      ["w1", { id: "w1", slug: "hope-creek", name: "Hope Creek" }],
    ]),
  });

  assert.equal(report.rows[0]?.status, "ready-for-outreach");
  assert.equal(report.statusCounts["ready-for-outreach"], 1);
});
