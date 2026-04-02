import assert from "node:assert/strict";
import test from "node:test";
import type { JobExecutionControls } from "@fieldpulse/platform-jobs";
import type { WorkerJobContext } from "./jobs/contracts/WorkerJobContext";
import { jobs, WORKSPACE_FIELD_SCHEDULE_CONCURRENCY } from "./jobs/registry";

type WeatherScheduleJob = {
  run: (
    context: WorkerJobContext,
    payload: {
      workspaceId: string;
      requestedAt?: string;
      forecastHours?: number;
      fieldIds?: readonly string[];
      limit?: number;
    },
    execution: JobExecutionControls,
  ) => Promise<{
    workspaceId: string;
    requestedAt: string;
    fieldCount: number;
    queuedCount: number;
    queuedDispatchIds: readonly string[];
  }>;
};

type SimpleWorkspaceScheduleJob = WeatherScheduleJob;

function createWorkspaceScheduleJob(
  key:
    | "weather.schedule-workspace-refresh"
    | "moisture.schedule-workspace-estimate-rebuild"
    | "intelligence.schedule-workspace-moisture-stress"
    | "intelligence.schedule-workspace-weather-risk"
    | "intelligence.schedule-workspace-action-brief",
): SimpleWorkspaceScheduleJob {
  const job = jobs.find((entry) => entry.key === key);
  assert.ok(job, `${key} should be registered`);
  return job as SimpleWorkspaceScheduleJob;
}

function createMockContext(fields: readonly {
  id: string;
  workspaceId: string;
  name: string;
  areaHa: number;
  legalLandDescription: string | null;
  latestMoisture: null;
}[]) {
  let inFlight = 0;
  let maxInFlight = 0;

  const context = {
    logger: {
      info() {},
      warn() {},
      error() {},
      debug() {},
    },
    runtime: {
      services: {
        catalog: {
          async loadWorkspaceFieldOverview() {
            return {
              selectedWorkspace: {
                id: "workspace-1",
              },
              primaryField: fields[0],
              fields,
            };
          },
        },
      },
    },
    async enqueueJob(input: {
      key: string;
      payload?: {
        workspaceId?: string;
        fieldId?: string;
        forecastHours?: number;
        observedAt?: string;
      };
    }) {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);

      const fieldNumber = Number(input.payload?.fieldId?.split("-").at(-1) ?? "0");
      await new Promise((resolve) => {
        setTimeout(resolve, (fields.length - fieldNumber) * 3);
      });

      inFlight -= 1;

      return {
        key: input.key,
        payload: input.payload,
        result: {
          id: `dispatch-${input.payload?.fieldId ?? "unknown"}`,
        },
      };
    },
    async resolveDefaultFieldTarget() {
      return {
        workspaceId: "workspace-1",
        fieldId: fields[0].id,
      };
    },
  } as unknown as WorkerJobContext;

  return {
    context,
    getMaxInFlight() {
      return maxInFlight;
    },
  };
}

test("weather.schedule-workspace-refresh enqueues fields with bounded concurrency and preserves field order", async () => {
  const scheduleJob = createWorkspaceScheduleJob("weather.schedule-workspace-refresh");
  const fields = Array.from(
    { length: WORKSPACE_FIELD_SCHEDULE_CONCURRENCY + 3 },
    (_, index) => ({
      id: `field-${index + 1}`,
      workspaceId: "workspace-1",
      name: `Field ${index + 1}`,
      areaHa: 64 + index,
      legalLandDescription: null,
      latestMoisture: null,
    }),
  );
  const progressUpdates: number[] = [];
  const { context, getMaxInFlight } = createMockContext(fields);

  const execution: JobExecutionControls = {
    dispatchId: "dispatch-1",
    attempt: 1,
    workerName: "test-worker",
    async reportProgress(update) {
      if (typeof update.progressPct === "number") {
        progressUpdates.push(update.progressPct);
      }
    },
    async throwIfCancellationRequested() {
      return;
    },
  };

  const result = await scheduleJob.run(
    context,
    {
      workspaceId: "workspace-1",
      requestedAt: "2026-03-29T12:00:00.000Z",
      forecastHours: 72,
    },
    execution,
  );

  assert.equal(getMaxInFlight(), WORKSPACE_FIELD_SCHEDULE_CONCURRENCY);
  assert.equal(result.workspaceId, "workspace-1");
  assert.equal(result.fieldCount, fields.length);
  assert.equal(result.queuedCount, fields.length);
  assert.deepEqual(
    result.queuedDispatchIds,
    fields.map((field) => `dispatch-${field.id}`),
  );
  assert.equal(progressUpdates.at(-1), 100);
});

test("moisture.schedule-workspace-estimate-rebuild enqueues estimate rebuilds with bounded concurrency and preserves field order", async () => {
  const scheduleJob = createWorkspaceScheduleJob(
    "moisture.schedule-workspace-estimate-rebuild",
  );
  const fields = Array.from(
    { length: WORKSPACE_FIELD_SCHEDULE_CONCURRENCY + 2 },
    (_, index) => ({
      id: `field-${index + 1}`,
      workspaceId: "workspace-1",
      name: `Field ${index + 1}`,
      areaHa: 64 + index,
      legalLandDescription: null,
      latestMoisture: null,
    }),
  );
  const { context, getMaxInFlight } = createMockContext(fields);

  const result = await scheduleJob.run(
    context,
    {
      workspaceId: "workspace-1",
      requestedAt: "2026-03-30T10:00:00.000Z",
    },
    {
      dispatchId: "dispatch-estimate",
      attempt: 1,
      workerName: "test-worker",
      async reportProgress() {},
      async throwIfCancellationRequested() {
        return;
      },
    },
  );

  assert.equal(getMaxInFlight(), WORKSPACE_FIELD_SCHEDULE_CONCURRENCY);
  assert.equal(result.queuedCount, fields.length);
  assert.deepEqual(
    result.queuedDispatchIds,
    fields.map((field) => `dispatch-${field.id}`),
  );
});

test("intelligence.schedule-workspace-moisture-stress and intelligence.schedule-workspace-weather-risk preserve field order", async () => {
  const moistureJob = createWorkspaceScheduleJob(
    "intelligence.schedule-workspace-moisture-stress",
  );
  const weatherJob = createWorkspaceScheduleJob(
    "intelligence.schedule-workspace-weather-risk",
  );
  const fields = Array.from({ length: 5 }, (_, index) => ({
    id: `field-${index + 1}`,
    workspaceId: "workspace-1",
    name: `Field ${index + 1}`,
    areaHa: 64 + index,
    legalLandDescription: null,
    latestMoisture: null,
  }));
  const { context } = createMockContext(fields);
  const execution: JobExecutionControls = {
    dispatchId: "dispatch-intelligence",
    attempt: 1,
    workerName: "test-worker",
    async reportProgress() {},
    async throwIfCancellationRequested() {
      return;
    },
  };

  const [moistureResult, weatherResult] = await Promise.all([
    moistureJob.run(
      context,
      {
        workspaceId: "workspace-1",
        requestedAt: "2026-03-30T10:00:00.000Z",
      },
      execution,
    ),
    weatherJob.run(
      context,
      {
        workspaceId: "workspace-1",
        requestedAt: "2026-03-30T10:00:00.000Z",
      },
      execution,
    ),
  ]);

  assert.deepEqual(
    moistureResult.queuedDispatchIds,
    fields.map((field) => `dispatch-${field.id}`),
  );
  assert.deepEqual(
    weatherResult.queuedDispatchIds,
    fields.map((field) => `dispatch-${field.id}`),
  );
});

test("intelligence.schedule-workspace-action-brief preserves field order", async () => {
  const scheduleJob = createWorkspaceScheduleJob(
    "intelligence.schedule-workspace-action-brief",
  );
  const fields = Array.from({ length: 5 }, (_, index) => ({
    id: `field-${index + 1}`,
    workspaceId: "workspace-1",
    name: `Field ${index + 1}`,
    areaHa: 64 + index,
    legalLandDescription: null,
    latestMoisture: null,
  }));
  const { context } = createMockContext(fields);

  const result = await scheduleJob.run(
    context,
    {
      workspaceId: "workspace-1",
      requestedAt: "2026-03-30T10:00:00.000Z",
    },
    {
      dispatchId: "dispatch-action-brief",
      attempt: 1,
      workerName: "test-worker",
      async reportProgress() {},
      async throwIfCancellationRequested() {
        return;
      },
    },
  );

  assert.deepEqual(
    result.queuedDispatchIds,
    fields.map((field) => `dispatch-${field.id}`),
  );
});
