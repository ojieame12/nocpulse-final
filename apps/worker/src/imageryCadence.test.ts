import test from "node:test";
import assert from "node:assert/strict";
import type {
  JobDispatchResult,
  PersistentJobDispatchRecord,
} from "@fieldpulse/platform-jobs";
import {
  IMAGERY_CADENCE_JOB_KEYS,
  drainScheduledImageryJobs,
  recoverStaleImageryJobs,
  runImageryCadence,
  type ImageryCadenceQueue,
  type ImageryCadenceReport,
} from "./imageryCadence";

function createReport(): ImageryCadenceReport {
  return {
    generatedAt: "2026-03-28T07:00:00.000Z",
    createdAfter: "2026-03-28T06:55:00.000Z",
    staleBefore: "2026-03-27T07:00:00.000Z",
    scannedCaptureCount: 2,
    refreshedFieldCount: 2,
    materializedFieldCount: 2,
    unavailableFieldCount: 0,
    staleFieldCount: 1,
    workspaceSummaries: [
      {
        workspaceId: "workspace-1",
        workspaceName: "FieldPulse Dev Farm",
        workspaceSlug: "fieldpulse-dev-farm",
        providerKey: "sentinel-1",
        captureCount: 2,
        refreshedFieldCount: 2,
        materializedFieldCount: 2,
        unavailableFieldCount: 0,
        latestRequestedAt: "2026-03-28T06:55:00.000Z",
        latestCapturedAt: "2026-03-24T13:39:13.000Z",
      },
    ],
    fieldIssues: [
      {
        workspaceId: "workspace-1",
        workspaceName: "FieldPulse Dev Farm",
        workspaceSlug: "fieldpulse-dev-farm",
        fieldId: "field-2",
        fieldName: "Batch South 066039",
        lastRequestedAt: null,
        lastCapturedAt: null,
        lastProviderKey: null,
        lastStatus: null,
        issueType: "missing-imagery",
      },
    ],
  };
}

test("runImageryCadence enqueues workspace syncs, recovers stale jobs, drains queue, and builds report", async () => {
  const enqueueCalls: unknown[] = [];
  const recoverCalls: unknown[] = [];
  const drainCalls: unknown[] = [];
  const reportCalls: unknown[] = [];

  const recoveredDispatch: PersistentJobDispatchRecord = {
    id: "recovered-1",
    key: "imagery.sync-latest",
    status: "queued",
    payload: {},
    attempts: 0,
    availableAt: "2026-03-28T06:55:00.000Z",
    lockedAt: null,
    lockedBy: null,
    attemptStartedAt: null,
    lastHeartbeatAt: null,
    activePhaseKey: null,
    activePhaseLabel: null,
    activePhaseStartedAt: null,
    lastAttemptDurationMs: null,
    progressPct: null,
    progressMessage: null,
    progressUpdatedAt: null,
    cancelRequestedAt: null,
    cancelRequestedBy: null,
    cancelReason: null,
    cancelledAt: null,
    completedAt: null,
    failedAt: null,
    result: null,
    lastError: null,
    createdAt: "2026-03-28T06:55:00.000Z",
    updatedAt: "2026-03-28T06:55:00.000Z",
  };
  const drainedDispatch: JobDispatchResult = {
    key: "imagery.sync-latest",
    payload: {},
    result: {
      id: "drained-1",
      key: "imagery.sync-latest",
      status: "completed",
    },
  };
  const scheduledDispatch: PersistentJobDispatchRecord = {
    id: "scheduled-1",
    key: "imagery.schedule-workspace-sync",
    status: "queued",
    payload: {},
    attempts: 0,
    availableAt: "2026-03-28T06:55:00.000Z",
    lockedAt: null,
    lockedBy: null,
    attemptStartedAt: null,
    lastHeartbeatAt: null,
    activePhaseKey: null,
    activePhaseLabel: null,
    activePhaseStartedAt: null,
    lastAttemptDurationMs: null,
    progressPct: null,
    progressMessage: null,
    progressUpdatedAt: null,
    cancelRequestedAt: null,
    cancelRequestedBy: null,
    cancelReason: null,
    cancelledAt: null,
    completedAt: null,
    failedAt: null,
    result: null,
    lastError: null,
    createdAt: "2026-03-28T06:55:00.000Z",
    updatedAt: "2026-03-28T06:55:00.000Z",
  };

  const queue: ImageryCadenceQueue = {
    async enqueue(input) {
      enqueueCalls.push(input);
      return {
        key: input.key,
        payload: input.payload,
        result: scheduledDispatch,
      };
    },
    async recoverStaleDispatches(input) {
      recoverCalls.push(input);
      return [recoveredDispatch];
    },
    async drainMatching(input) {
      drainCalls.push(input);
      return [drainedDispatch];
    },
  };

  const report = createReport();
  const result = await runImageryCadence({
    queue,
    targets: [
      {
        workspaceId: "workspace-1",
        workspaceSlug: "fieldpulse-dev-farm",
      },
    ],
    requestedAt: "2026-03-28T06:55:00.000Z",
    workspaceId: "workspace-1",
    fieldId: "field-1",
    limit: 4,
    dryRun: false,
    providers: ["sentinel-2", "planet"],
    drainLimit: 5,
    staleAfterHours: 24,
    reportLimit: 50,
    async buildRecentSyncReport(input) {
      reportCalls.push(input);
      return report;
    },
  });

  assert.equal(enqueueCalls.length, 1);
  assert.deepEqual(enqueueCalls[0], {
    key: "imagery.schedule-workspace-sync",
    payload: {
      workspaceId: "workspace-1",
      requestedAt: "2026-03-28T06:55:00.000Z",
      fieldIds: ["field-1"],
      limit: 4,
      dryRun: false,
      providers: ["sentinel-2", "planet"],
    },
  });

  assert.deepEqual(recoverCalls, [
    {
      limit: 5,
      requestedBy: "worker-imagery-cadence",
    },
  ]);
  assert.deepEqual(drainCalls, [
    {
      limit: 5,
      keys: [...IMAGERY_CADENCE_JOB_KEYS],
    },
  ]);
  assert.deepEqual(reportCalls, [
    {
      workspaceId: "workspace-1",
      createdAfter: "2026-03-28T06:55:00.000Z",
      staleAfterHours: 24,
      limit: 50,
    },
  ]);

  assert.equal(result.requestedAt, "2026-03-28T06:55:00.000Z");
  assert.equal(result.scheduledDispatches.length, 1);
  assert.deepEqual(result.recoveredStaleDispatches, [recoveredDispatch]);
  assert.deepEqual(result.drainedDispatches, [drainedDispatch]);
  assert.equal(result.report.fieldIssues[0]?.fieldName, "Batch South 066039");
  assert.equal(result.scheduledDispatches[0]?.dispatch.id, "scheduled-1");
});

test("drainScheduledImageryJobs retries once after an empty first drain", async () => {
  const drainCalls: unknown[] = [];
  const sleepCalls: number[] = [];

  const queue: ImageryCadenceQueue = {
    async enqueue() {
      throw new Error("enqueue should not be called");
    },
    async recoverStaleDispatches() {
      throw new Error("recoverStaleDispatches should not be called");
    },
    async drainMatching(input) {
      drainCalls.push(input);
      return drainCalls.length === 1
        ? []
        : [
            {
              key: "imagery.sync-latest",
              payload: {},
              result: {
                id: "drained-after-retry",
                key: "imagery.sync-latest",
                status: "completed",
              },
            },
          ];
    },
  };

  const drained = await drainScheduledImageryJobs({
    queue,
    limit: 3,
    async sleepFn(ms) {
      sleepCalls.push(ms);
    },
  });

  assert.equal(drainCalls.length, 2);
  assert.deepEqual(drainCalls[0], {
    limit: 3,
    keys: [...IMAGERY_CADENCE_JOB_KEYS],
  });
  assert.deepEqual(drainCalls[1], {
    limit: 3,
    keys: [...IMAGERY_CADENCE_JOB_KEYS],
  });
  assert.deepEqual(sleepCalls, [350]);
  assert.equal(
    (drained[0]?.result as { id?: string } | undefined)?.id,
    "drained-after-retry",
  );
});

test("recoverStaleImageryJobs uses the worker-imagery-cadence recovery label", async () => {
  const recoverCalls: unknown[] = [];

  const queue: ImageryCadenceQueue = {
    async enqueue() {
      throw new Error("enqueue should not be called");
    },
    async recoverStaleDispatches(input) {
      recoverCalls.push(input);
      return [];
    },
    async drainMatching() {
      throw new Error("drainMatching should not be called");
    },
  };

  await recoverStaleImageryJobs({
    queue,
    limit: 7,
  });

  assert.deepEqual(recoverCalls, [
    {
      limit: 7,
      requestedBy: "worker-imagery-cadence",
    },
  ]);
});
