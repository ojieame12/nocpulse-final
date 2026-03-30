import test from "node:test";
import assert from "node:assert/strict";
import type {
  JobDispatchResult,
  JobKey,
  PersistentJobDispatchRecord,
} from "@fieldpulse/platform-jobs";
import type { FieldIntelligenceFinding } from "@fieldpulse/module-crop-intelligence";
import {
  WEATHER_REFRESH_CADENCE_JOB_KEYS,
  WEATHER_RISK_CADENCE_JOB_KEYS,
  runWeatherRiskCadence,
  type WeatherRiskCadenceQueue,
} from "./weatherRiskCadence";

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

test("runWeatherRiskCadence refreshes weather first, then schedules weather-risk generation, then summarizes active findings", async () => {
  const enqueueCalls: unknown[] = [];
  const drainCalls: unknown[] = [];
  const loadCalls: unknown[] = [];

  const drainedWeatherDispatch: JobDispatchResult = {
    key: "weather.refresh-field",
    payload: {},
    result: {
      id: "drained-weather-1",
      key: "weather.refresh-field",
      status: "completed",
    },
  };
  const drainedRiskDispatch: JobDispatchResult = {
    key: "intelligence.generate-weather-risk",
    payload: {},
    result: {
      id: "drained-weather-risk-1",
      key: "intelligence.generate-weather-risk",
      status: "completed",
    },
  };

  const queue: WeatherRiskCadenceQueue = {
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

      return [drainedRiskDispatch];
    },
  };

  const result = await runWeatherRiskCadence({
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
          family: "weather_risk",
          severity: "high",
          status: "active",
          sourceKey: "weather-risk-generator:frost:signal-v1",
          dedupeKey: "weather-risk:frost:prairie-default-frost",
          title: "Frost risk building next 24h",
          summary: "",
          explanation: "",
          recommendedAction: "",
          confidence: 0.8,
          zoneGeoJson: null,
          affectedCellKeys: [],
          evidence: {},
          startedAt: "2026-03-30T10:00:00.000Z",
          endedAt: null,
          createdAt: "2026-03-30T10:00:00.000Z",
          updatedAt: "2026-03-30T10:02:00.000Z",
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
      key: "intelligence.schedule-workspace-weather-risk",
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
      keys: [...WEATHER_REFRESH_CADENCE_JOB_KEYS],
    },
    {
      limit: 5,
      keys: [...WEATHER_RISK_CADENCE_JOB_KEYS],
    },
  ]);
  assert.deepEqual(loadCalls, [
    {
      workspaceId: "workspace-1",
      limit: 20,
      status: "active",
      family: "weather_risk",
      updatedAfter: "2026-03-30T10:00:00.000Z",
    },
  ]);
  assert.equal(result.summaries[0]?.activeFindingCount, 1);
  assert.equal(result.summaries[0]?.activeFieldCount, 1);
  assert.equal(result.summaries[0]?.topFindings[0]?.title, "Frost risk building next 24h");
});
