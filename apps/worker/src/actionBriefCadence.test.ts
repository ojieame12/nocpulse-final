import test from "node:test";
import assert from "node:assert/strict";
import type {
  JobDispatchResult,
  JobKey,
  PersistentJobDispatchRecord,
} from "@fieldpulse/platform-jobs";
import type { FieldIntelligenceFinding } from "@fieldpulse/module-crop-intelligence";
import {
  ACTION_BRIEF_INTELLIGENCE_JOB_KEYS,
  ACTION_BRIEF_WEATHER_JOB_KEYS,
  runActionBriefCadence,
  type ActionBriefCadenceQueue,
} from "./actionBriefCadence.shared";

function createScheduledDispatch(
  id: string,
  key: JobKey,
): PersistentJobDispatchRecord {
  return {
    id,
    key,
    status: "queued",
    payload: {},
    attempts: 0,
    availableAt: "2026-03-30T10:00:00.000Z",
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
    createdAt: "2026-03-30T10:00:00.000Z",
    updatedAt: "2026-03-30T10:00:00.000Z",
  };
}

test("runActionBriefCadence skips weather refresh by default and schedules action-brief generation from existing context", async () => {
  const enqueueCalls: unknown[] = [];
  const drainCalls: unknown[] = [];
  const loadCalls: unknown[] = [];
  const drainedActionBriefDispatch: JobDispatchResult = {
    key: "intelligence.generate-action-brief",
    payload: {},
    result: {
      id: "drained-action-brief-1",
      key: "intelligence.generate-action-brief",
      status: "completed",
    },
  };

  const queue: ActionBriefCadenceQueue = {
    async enqueue(input) {
      enqueueCalls.push(input);
      return {
        key: input.key,
        payload: input.payload,
        result: createScheduledDispatch(`scheduled-${enqueueCalls.length}`, input.key),
      };
    },
    async drainMatching(input) {
      drainCalls.push(input);
      return [drainedActionBriefDispatch];
    },
  };

  const result = await runActionBriefCadence({
    queue,
    targets: [{
      workspaceId: "workspace-1",
      workspaceSlug: "hope-creek",
    }],
    requestedAt: "2026-03-30T10:00:00.000Z",
    workspaceId: "workspace-1",
    fieldId: "field-1",
    limit: 4,
    forecastHours: 48,
    refreshWeather: false,
    drainLimit: 5,
    reportLimit: 20,
    async loadWorkspaceFindings(input) {
      loadCalls.push(input);
      return [
        {
          id: "finding-1",
          workspaceId: "workspace-1",
          fieldId: "field-1",
          runId: "run-1",
          family: "action_brief",
          severity: "medium",
          status: "active",
          sourceKey: "action-brief-generator:moisture-snapshot",
          dedupeKey: "action-brief:material-change:v1",
          title: "Field changed materially since last review",
          summary: "",
          explanation: "",
          recommendedAction: "",
          confidence: 0.74,
          zoneGeoJson: null,
          affectedCellKeys: [],
          evidence: {},
          startedAt: "2026-03-30T10:00:00.000Z",
          endedAt: null,
          createdAt: "2026-03-30T10:00:00.000Z",
          updatedAt: "2026-03-30T10:04:00.000Z",
        },
      ] satisfies readonly FieldIntelligenceFinding[];
    },
  });

  assert.deepEqual(enqueueCalls, [
    {
      key: "intelligence.schedule-workspace-action-brief",
      payload: {
        workspaceId: "workspace-1",
        requestedAt: "2026-03-30T10:00:00.000Z",
        fieldIds: ["field-1"],
        limit: 4,
      },
    },
  ]);
  assert.deepEqual(drainCalls, [
    {
      limit: 5,
      keys: [...ACTION_BRIEF_INTELLIGENCE_JOB_KEYS],
    },
  ]);
  assert.deepEqual(loadCalls, [
    {
      workspaceId: "workspace-1",
      limit: 20,
      status: "active",
      family: "action_brief",
      updatedAfter: "2026-03-30T10:00:00.000Z",
    },
  ]);
  assert.equal(result.summaries[0]?.activeFindingCount, 1);
  assert.equal(result.summaries[0]?.activeFieldCount, 1);
  assert.equal(
    result.summaries[0]?.topFindings[0]?.title,
    "Field changed materially since last review",
  );
  assert.equal(result.drainedWeatherDispatches.length, 0);
  assert.equal(result.scheduledWeatherDispatches.length, 0);
});

test("runActionBriefCadence can still refresh weather explicitly before scheduling action-brief generation", async () => {
  const enqueueCalls: unknown[] = [];
  const drainCalls: unknown[] = [];

  const drainedWeatherDispatch: JobDispatchResult = {
    key: "weather.refresh-field",
    payload: {},
    result: {
      id: "drained-weather-1",
      key: "weather.refresh-field",
      status: "completed",
    },
  };
  const drainedActionBriefDispatch: JobDispatchResult = {
    key: "intelligence.generate-action-brief",
    payload: {},
    result: {
      id: "drained-action-brief-1",
      key: "intelligence.generate-action-brief",
      status: "completed",
    },
  };

  const queue: ActionBriefCadenceQueue = {
    async enqueue(input) {
      enqueueCalls.push(input);
      return {
        key: input.key,
        payload: input.payload,
        result: createScheduledDispatch(`scheduled-${enqueueCalls.length}`, input.key),
      };
    },
    async drainMatching(input) {
      drainCalls.push(input);
      if (input.keys.includes("weather.refresh-field")) {
        return [drainedWeatherDispatch];
      }

      return [drainedActionBriefDispatch];
    },
  };

  await runActionBriefCadence({
    queue,
    targets: [{
      workspaceId: "workspace-1",
      workspaceSlug: "hope-creek",
    }],
    requestedAt: "2026-03-30T10:00:00.000Z",
    workspaceId: "workspace-1",
    fieldId: "field-1",
    limit: 4,
    forecastHours: 48,
    refreshWeather: true,
    drainLimit: 5,
    reportLimit: 20,
    async loadWorkspaceFindings() {
      return [];
    },
  });

  assert.deepEqual(enqueueCalls, [
    {
      key: "weather.schedule-workspace-refresh",
      payload: {
        workspaceId: "workspace-1",
        requestedAt: "2026-03-30T10:00:00.000Z",
        fieldIds: ["field-1"],
        limit: 4,
        forecastHours: 48,
      },
    },
    {
      key: "intelligence.schedule-workspace-action-brief",
      payload: {
        workspaceId: "workspace-1",
        requestedAt: "2026-03-30T10:00:00.000Z",
        fieldIds: ["field-1"],
        limit: 4,
      },
    },
  ]);
  assert.deepEqual(drainCalls, [
    {
      limit: 5,
      keys: [...ACTION_BRIEF_WEATHER_JOB_KEYS],
    },
    {
      limit: 5,
      keys: [...ACTION_BRIEF_INTELLIGENCE_JOB_KEYS],
    },
  ]);
});
