import test from "node:test";
import assert from "node:assert/strict";
import type {
  JobDispatchResult,
  JobKey,
  PersistentJobDispatchRecord,
} from "@fieldpulse/platform-jobs";
import type { FieldIntelligenceFinding } from "@fieldpulse/module-crop-intelligence";
import {
  MOISTURE_STRESS_ESTIMATE_JOB_KEYS,
  MOISTURE_STRESS_INTELLIGENCE_JOB_KEYS,
  MOISTURE_STRESS_WEATHER_JOB_KEYS,
  runMoistureStressCadence,
  type MoistureStressCadenceQueue,
} from "./moistureStressCadence";

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

test("runMoistureStressCadence refreshes weather, rebuilds moisture estimates, then schedules moisture-stress generation", async () => {
  const enqueueCalls: unknown[] = [];
  const drainCalls: unknown[] = [];
  const loadCalls: unknown[] = [];

  const queue: MoistureStressCadenceQueue = {
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
      const keys = input.keys.join(",");

      if (keys === MOISTURE_STRESS_WEATHER_JOB_KEYS.join(",")) {
        return [{
          key: "weather.refresh-field",
          payload: {},
          result: { id: "drained-weather", key: "weather.refresh-field", status: "completed" },
        }];
      }

      if (keys === MOISTURE_STRESS_ESTIMATE_JOB_KEYS.join(",")) {
        return [{
          key: "moisture.rebuild-field-estimate",
          payload: {},
          result: {
            id: "drained-estimate",
            key: "moisture.rebuild-field-estimate",
            status: "completed",
          },
        }];
      }

      return [{
        key: "intelligence.generate-moisture-stress",
        payload: {},
        result: {
          id: "drained-moisture-stress",
          key: "intelligence.generate-moisture-stress",
          status: "completed",
        },
      }];
    },
  };

  const result = await runMoistureStressCadence({
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
          family: "moisture_stress",
          severity: "medium",
          status: "active",
          sourceKey: "moisture-stress-generator:signal-v1",
          dedupeKey: "moisture-stress:prairie-default",
          title: "Moisture stress building",
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
          updatedAt: "2026-03-30T10:03:00.000Z",
        },
      ] satisfies readonly FieldIntelligenceFinding[];
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
      key: "moisture.schedule-workspace-estimate-rebuild",
      payload: {
        workspaceId: "workspace-1",
        requestedAt: "2026-03-30T10:00:00.000Z",
        fieldIds: ["field-1"],
        limit: 4,
      },
    },
    {
      key: "intelligence.schedule-workspace-moisture-stress",
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
      keys: [...MOISTURE_STRESS_WEATHER_JOB_KEYS],
    },
    {
      limit: 5,
      keys: [...MOISTURE_STRESS_ESTIMATE_JOB_KEYS],
    },
    {
      limit: 5,
      keys: [...MOISTURE_STRESS_INTELLIGENCE_JOB_KEYS],
    },
  ]);
  assert.deepEqual(loadCalls, [
    {
      workspaceId: "workspace-1",
      limit: 20,
      status: "active",
      family: "moisture_stress",
      updatedAfter: "2026-03-30T10:00:00.000Z",
    },
  ]);
  assert.equal(result.summaries[0]?.activeFindingCount, 1);
  assert.equal(result.summaries[0]?.activeFieldCount, 1);
  assert.equal(result.summaries[0]?.topFindings[0]?.title, "Moisture stress building");
});
