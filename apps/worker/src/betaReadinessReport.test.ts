import test from "node:test";
import assert from "node:assert/strict";
import { buildBetaReadinessAssessment } from "./betaReadinessReport";

test("buildBetaReadinessAssessment returns GO when core beta gates are healthy", () => {
  const result = buildBetaReadinessAssessment({
    queueHealth: {
      totalCount: 10,
      queuedCount: 0,
      runningCount: 0,
      completedCount: 10,
      failedCount: 0,
      cancelledCount: 0,
      staleRunningCount: 0,
      cancellationRequestedCount: 0,
      oldestQueuedAt: null,
      oldestRunningAt: null,
      latestUpdatedAt: "2026-04-02T12:00:00.000Z",
    },
    actionBrief: {
      queuedCount: 0,
      runningCount: 0,
      completedCount: 12,
      failedCount: 0,
      cancelledCount: 0,
    },
    actionBriefReview: {
      workspaceCount: 1,
      reviewEligibleWorkspaceCount: 1,
      unreviewableWorkspaceCount: 0,
      totalAlertCount: 8,
      alertCount: 8,
      unreviewableAlertCount: 0,
      activeCount: 1,
      resolvedCount: 5,
      dismissedCount: 2,
      acknowledgedCount: 7,
      unacknowledgedActiveCount: 0,
      averageHoursToAcknowledge: 6,
      averageHoursToResolution: 24,
      dismissalRate: 0.25,
      resolutionRate: 0.625,
    },
    sourceIntegrity: {
      fieldCount: 20,
      sourceBackedLatestCount: 20,
      seededFallbackCount: 0,
      syntheticRasterCount: 0,
      missingSoilContextCount: 0,
      lowConfidenceCount: 0,
    },
    fieldQuality: {
      generatedAt: "2026-04-02T12:00:00.000Z",
      workspaceFilter: "hope-creek",
      workspaceId: "workspace-1",
      workspaceSlug: "hope-creek",
      lookbackDays: 30,
      fieldCount: 20,
      readyCount: 12,
      thinCount: 8,
      fallbackCount: 0,
      brokenCount: 0,
      vegetationReadyCount: 12,
      moistureReadyCount: 12,
      sourceBackedLatestCount: 20,
      seededFallbackCount: 0,
      syntheticRasterCount: 0,
      missingSoilContextCount: 0,
      lowConfidenceCount: 0,
      reasonCounts: {},
    },
    firstInsight: {
      eventCount: 5,
      uniqueActorCount: 2,
      uniqueFieldCount: 3,
      allowlistedEventCount: 5,
      nonAllowlistedEventCount: 0,
      averageWorkspaceSummaryComparisonCount: 3,
    },
  });

  assert.equal(result.overallStatus, "GO");
  assert.equal(result.gates.every((gate) => gate.status === "GO"), true);
  assert.deepEqual(result.nextActions, []);
});

test("buildBetaReadinessAssessment returns NO-GO when queue and insight evidence are missing", () => {
  const result = buildBetaReadinessAssessment({
    queueHealth: {
      totalCount: 150,
      queuedCount: 120,
      runningCount: 3,
      completedCount: 20,
      failedCount: 7,
      cancelledCount: 0,
      staleRunningCount: 1,
      cancellationRequestedCount: 0,
      oldestQueuedAt: "2026-04-02T10:00:00.000Z",
      oldestRunningAt: "2026-04-02T10:05:00.000Z",
      latestUpdatedAt: "2026-04-02T12:00:00.000Z",
    },
    actionBrief: {
      queuedCount: 0,
      runningCount: 0,
      completedCount: 0,
      failedCount: 0,
      cancelledCount: 0,
    },
    actionBriefReview: {
      workspaceCount: 0,
      reviewEligibleWorkspaceCount: 0,
      unreviewableWorkspaceCount: 0,
      totalAlertCount: 0,
      alertCount: 0,
      unreviewableAlertCount: 0,
      activeCount: 0,
      resolvedCount: 0,
      dismissedCount: 0,
      acknowledgedCount: 0,
      unacknowledgedActiveCount: 0,
      averageHoursToAcknowledge: null,
      averageHoursToResolution: null,
      dismissalRate: null,
      resolutionRate: null,
    },
    sourceIntegrity: {
      fieldCount: 30,
      sourceBackedLatestCount: 10,
      seededFallbackCount: 8,
      syntheticRasterCount: 6,
      missingSoilContextCount: 5,
      lowConfidenceCount: 10,
    },
    fieldQuality: {
      generatedAt: "2026-04-02T12:00:00.000Z",
      workspaceFilter: "dev-farm",
      workspaceId: "workspace-2",
      workspaceSlug: "dev-farm",
      lookbackDays: 30,
      fieldCount: 30,
      readyCount: 4,
      thinCount: 20,
      fallbackCount: 4,
      brokenCount: 2,
      vegetationReadyCount: 4,
      moistureReadyCount: 4,
      sourceBackedLatestCount: 10,
      seededFallbackCount: 8,
      syntheticRasterCount: 6,
      missingSoilContextCount: 5,
      lowConfidenceCount: 10,
      reasonCounts: {},
    },
    firstInsight: {
      eventCount: 0,
      uniqueActorCount: 0,
      uniqueFieldCount: 0,
      allowlistedEventCount: 0,
      nonAllowlistedEventCount: 0,
      averageWorkspaceSummaryComparisonCount: null,
    },
  });

  assert.equal(result.overallStatus, "NO-GO");
  assert.equal(
    result.gates.some((gate) => gate.key === "queue-health" && gate.status === "NO-GO"),
    true,
  );
  assert.equal(
    result.gates.some((gate) => gate.key === "first-insight" && gate.status === "NO-GO"),
    true,
  );
  assert.equal(result.nextActions.length > 0, true);
});

test("buildBetaReadinessAssessment points first-insight follow-up at launch-visible curation when ready fields are short", () => {
  const result = buildBetaReadinessAssessment({
    queueHealth: {
      totalCount: 10,
      queuedCount: 0,
      runningCount: 0,
      completedCount: 10,
      failedCount: 0,
      cancelledCount: 0,
      staleRunningCount: 0,
      cancellationRequestedCount: 0,
      oldestQueuedAt: null,
      oldestRunningAt: null,
      latestUpdatedAt: "2026-04-02T12:00:00.000Z",
    },
    actionBrief: {
      queuedCount: 0,
      runningCount: 0,
      completedCount: 12,
      failedCount: 0,
      cancelledCount: 0,
    },
    actionBriefReview: {
      workspaceCount: 1,
      reviewEligibleWorkspaceCount: 1,
      unreviewableWorkspaceCount: 0,
      totalAlertCount: 4,
      alertCount: 4,
      unreviewableAlertCount: 0,
      activeCount: 1,
      resolvedCount: 2,
      dismissedCount: 1,
      acknowledgedCount: 3,
      unacknowledgedActiveCount: 1,
      averageHoursToAcknowledge: 4,
      averageHoursToResolution: 12,
      dismissalRate: 0.25,
      resolutionRate: 0.5,
    },
    sourceIntegrity: {
      fieldCount: 10,
      sourceBackedLatestCount: 10,
      seededFallbackCount: 0,
      syntheticRasterCount: 0,
      missingSoilContextCount: 0,
      lowConfidenceCount: 0,
    },
    fieldQuality: {
      generatedAt: "2026-04-02T12:00:00.000Z",
      workspaceFilter: "tight-scope",
      workspaceId: "workspace-3",
      workspaceSlug: "tight-scope",
      lookbackDays: 30,
      fieldCount: 10,
      readyCount: 1,
      thinCount: 9,
      fallbackCount: 0,
      brokenCount: 0,
      vegetationReadyCount: 1,
      moistureReadyCount: 10,
      sourceBackedLatestCount: 10,
      seededFallbackCount: 0,
      syntheticRasterCount: 0,
      missingSoilContextCount: 0,
      lowConfidenceCount: 0,
      reasonCounts: {
        "vegetation-thin": 9,
      },
    },
    firstInsight: {
      eventCount: 0,
      uniqueActorCount: 0,
      uniqueFieldCount: 0,
      allowlistedEventCount: 0,
      nonAllowlistedEventCount: 0,
      averageWorkspaceSummaryComparisonCount: null,
    },
  });

  const firstInsightGate = result.gates.find((gate) => gate.key === "first-insight");
  assert.ok(firstInsightGate);
  assert.match(firstInsightGate.summary, /short by 1 ready field/);
  assert.equal(
    result.nextActions.includes(
      "Promote or replace at least 1 ready launch-visible field(s) before the next first-insight walkthrough.",
    ),
    true,
  );
});

test("buildBetaReadinessAssessment returns NO-GO when action brief trust is weak despite healthy cadence", () => {
  const result = buildBetaReadinessAssessment({
    queueHealth: {
      totalCount: 10,
      queuedCount: 0,
      runningCount: 0,
      completedCount: 10,
      failedCount: 0,
      cancelledCount: 0,
      staleRunningCount: 0,
      cancellationRequestedCount: 0,
      oldestQueuedAt: null,
      oldestRunningAt: null,
      latestUpdatedAt: "2026-04-02T12:00:00.000Z",
    },
    actionBrief: {
      queuedCount: 0,
      runningCount: 0,
      completedCount: 12,
      failedCount: 0,
      cancelledCount: 0,
    },
    actionBriefReview: {
      workspaceCount: 1,
      reviewEligibleWorkspaceCount: 1,
      unreviewableWorkspaceCount: 0,
      totalAlertCount: 10,
      alertCount: 10,
      unreviewableAlertCount: 0,
      activeCount: 6,
      resolvedCount: 1,
      dismissedCount: 3,
      acknowledgedCount: 4,
      unacknowledgedActiveCount: 6,
      averageHoursToAcknowledge: 48,
      averageHoursToResolution: 72,
      dismissalRate: 0.3,
      resolutionRate: 0.1,
    },
    sourceIntegrity: {
      fieldCount: 20,
      sourceBackedLatestCount: 20,
      seededFallbackCount: 0,
      syntheticRasterCount: 0,
      missingSoilContextCount: 0,
      lowConfidenceCount: 0,
    },
    fieldQuality: {
      generatedAt: "2026-04-02T12:00:00.000Z",
      workspaceFilter: "hope-creek",
      workspaceId: "workspace-1",
      workspaceSlug: "hope-creek",
      lookbackDays: 30,
      fieldCount: 20,
      readyCount: 12,
      thinCount: 8,
      fallbackCount: 0,
      brokenCount: 0,
      vegetationReadyCount: 12,
      moistureReadyCount: 12,
      sourceBackedLatestCount: 20,
      seededFallbackCount: 0,
      syntheticRasterCount: 0,
      missingSoilContextCount: 0,
      lowConfidenceCount: 0,
      reasonCounts: {},
    },
    firstInsight: {
      eventCount: 5,
      uniqueActorCount: 2,
      uniqueFieldCount: 3,
      allowlistedEventCount: 5,
      nonAllowlistedEventCount: 0,
      averageWorkspaceSummaryComparisonCount: 3,
    },
  });

  assert.equal(result.overallStatus, "NO-GO");
  assert.equal(
    result.gates.some((gate) => gate.key === "action-brief-review" && gate.status === "NO-GO"),
    true,
  );
  assert.equal(
    result.nextActions.includes(
      "Inspect action-brief review behavior and tune thresholds or copy if alerts are piling up or getting dismissed.",
    ),
    true,
  );
});

test("buildBetaReadinessAssessment downgrades action-brief trust to WARN when alerts exist but no reviewers are configured", () => {
  const result = buildBetaReadinessAssessment({
    queueHealth: {
      totalCount: 10,
      queuedCount: 0,
      runningCount: 0,
      completedCount: 10,
      failedCount: 0,
      cancelledCount: 0,
      staleRunningCount: 0,
      cancellationRequestedCount: 0,
      oldestQueuedAt: null,
      oldestRunningAt: null,
      latestUpdatedAt: "2026-04-02T12:00:00.000Z",
    },
    actionBrief: {
      queuedCount: 0,
      runningCount: 0,
      completedCount: 12,
      failedCount: 0,
      cancelledCount: 0,
    },
    actionBriefReview: {
      workspaceCount: 1,
      reviewEligibleWorkspaceCount: 0,
      unreviewableWorkspaceCount: 1,
      totalAlertCount: 16,
      alertCount: 0,
      unreviewableAlertCount: 16,
      activeCount: 0,
      resolvedCount: 0,
      dismissedCount: 0,
      acknowledgedCount: 0,
      unacknowledgedActiveCount: 0,
      averageHoursToAcknowledge: null,
      averageHoursToResolution: null,
      dismissalRate: null,
      resolutionRate: null,
    },
    sourceIntegrity: {
      fieldCount: 20,
      sourceBackedLatestCount: 20,
      seededFallbackCount: 0,
      syntheticRasterCount: 0,
      missingSoilContextCount: 0,
      lowConfidenceCount: 0,
    },
    fieldQuality: {
      generatedAt: "2026-04-02T12:00:00.000Z",
      workspaceFilter: "share-only",
      workspaceId: "workspace-share",
      workspaceSlug: "share-only",
      lookbackDays: 30,
      fieldCount: 20,
      readyCount: 12,
      thinCount: 8,
      fallbackCount: 0,
      brokenCount: 0,
      vegetationReadyCount: 12,
      moistureReadyCount: 12,
      sourceBackedLatestCount: 20,
      seededFallbackCount: 0,
      syntheticRasterCount: 0,
      missingSoilContextCount: 0,
      lowConfidenceCount: 0,
      reasonCounts: {},
    },
    firstInsight: {
      eventCount: 5,
      uniqueActorCount: 2,
      uniqueFieldCount: 3,
      allowlistedEventCount: 5,
      nonAllowlistedEventCount: 0,
      averageWorkspaceSummaryComparisonCount: 3,
    },
  });

  const gate = result.gates.find((entry) => entry.key === "action-brief-review");
  assert.ok(gate);
  assert.equal(gate.status, "WARN");
  assert.match(gate.summary, /no workspace members can review them yet/i);
  assert.equal(
    result.nextActions.includes(
      "Grant workspace access before using action-brief review as a trust gate for this scope.",
    ),
    true,
  );
});
