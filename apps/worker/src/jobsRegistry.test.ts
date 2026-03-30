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

function createScheduleWeatherJob(): WeatherScheduleJob {
  const job = jobs.find((entry) => entry.key === "weather.schedule-workspace-refresh");
  assert.ok(job, "weather schedule job should be registered");
  return job as WeatherScheduleJob;
}

test("weather.schedule-workspace-refresh enqueues fields with bounded concurrency and preserves field order", async () => {
  const scheduleJob = createScheduleWeatherJob();
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

  assert.equal(maxInFlight, WORKSPACE_FIELD_SCHEDULE_CONCURRENCY);
  assert.equal(result.workspaceId, "workspace-1");
  assert.equal(result.fieldCount, fields.length);
  assert.equal(result.queuedCount, fields.length);
  assert.deepEqual(
    result.queuedDispatchIds,
    fields.map((field) => `dispatch-${field.id}`),
  );
  assert.equal(progressUpdates.at(-1), 100);
});
