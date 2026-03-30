import type {
  JobDispatchResult,
  JobKey,
  PersistentJobDispatchRecord,
} from "@fieldpulse/platform-jobs";
import type { FieldIntelligenceFinding } from "@fieldpulse/module-crop-intelligence";
import { createServerRuntime } from "@fieldpulse/platform-runtime";
import { pathToFileURL } from "node:url";
import { loadWorkerEnv } from "./runtime/loadEnv";
import { createWorkerJobQueue } from "./runtime/createWorkerJobQueue";
import { formatDispatchTableRows } from "./runtime/jobCliFilters";
import {
  parseCliArgs,
  readBooleanFlag,
  readNumberFlag,
  readStringFlag,
} from "./runtime/parseCliArgs";
import { readRequestedAt } from "./runtime/readRequestedAt";
import { resolveWorkspaceDispatchTargets } from "./runtime/resolveWorkspaceDispatchTargets";
import { describeCliError } from "./runtime/describeCliError";

export const MOISTURE_STRESS_WEATHER_JOB_KEYS = [
  "weather.schedule-workspace-refresh",
  "weather.refresh-field",
] as const;

export const MOISTURE_STRESS_ESTIMATE_JOB_KEYS = [
  "moisture.schedule-workspace-estimate-rebuild",
  "moisture.rebuild-field-estimate",
] as const;

export const MOISTURE_STRESS_INTELLIGENCE_JOB_KEYS = [
  "intelligence.schedule-workspace-moisture-stress",
  "intelligence.generate-moisture-stress",
] as const;

export type MoistureStressCadenceTarget = {
  workspaceId: string;
  workspaceSlug: string;
};

export type MoistureStressCadenceSummary = {
  workspaceId: string;
  workspaceSlug: string;
  activeFindingCount: number;
  activeFieldCount: number;
  topFindings: readonly {
    fieldId: string;
    title: string;
    severity: string;
    updatedAt: string;
  }[];
};

export type MoistureStressCadenceQueue = {
  enqueue(
    input:
      | {
          key: "weather.schedule-workspace-refresh";
          payload: {
            workspaceId: string;
            requestedAt: string;
            fieldIds?: readonly string[];
            limit?: number;
            forecastHours?: number;
          };
        }
      | {
          key: "moisture.schedule-workspace-estimate-rebuild";
          payload: {
            workspaceId: string;
            requestedAt: string;
            fieldIds?: readonly string[];
            limit?: number;
          };
        }
      | {
          key: "intelligence.schedule-workspace-moisture-stress";
          payload: {
            workspaceId: string;
            requestedAt: string;
            fieldIds?: readonly string[];
            limit?: number;
          };
        },
  ): Promise<JobDispatchResult>;
  drainMatching(input: {
    limit: number;
    keys: readonly JobKey[];
  }): Promise<readonly JobDispatchResult[]>;
};

export type RunMoistureStressCadenceInput = {
  queue: MoistureStressCadenceQueue;
  targets: readonly MoistureStressCadenceTarget[];
  requestedAt: string;
  workspaceId?: string;
  fieldId?: string;
  limit?: number;
  forecastHours?: number;
  drainLimit: number;
  reportLimit: number;
  loadWorkspaceFindings: (input: {
    workspaceId: string;
    limit?: number;
    status?: "active";
    family?: "moisture_stress";
    updatedAfter?: string;
  }) => Promise<readonly FieldIntelligenceFinding[]>;
  sleepFn?: (ms: number) => Promise<void>;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPersistentDispatchRecord(
  value: unknown,
): value is PersistentJobDispatchRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "key" in value &&
    "status" in value &&
    "availableAt" in value &&
    "createdAt" in value &&
    "updatedAt" in value
  );
}

function toScheduledDispatchRecord(
  dispatch: JobDispatchResult,
): PersistentJobDispatchRecord {
  if (isPersistentDispatchRecord(dispatch.result)) {
    return dispatch.result;
  }

  throw new Error(
    "[worker-moisture-stress-cadence] persistent queue enqueue did not return a dispatch record",
  );
}

async function drainMatchingWithRetry(input: {
  queue: MoistureStressCadenceQueue;
  limit: number;
  keys: readonly JobKey[];
  sleepFn?: (ms: number) => Promise<void>;
}) {
  const drained = await input.queue.drainMatching({
    limit: input.limit,
    keys: [...input.keys],
  });

  if (drained.length > 0) {
    return drained;
  }

  await (input.sleepFn ?? sleep)(350);

  return input.queue.drainMatching({
    limit: input.limit,
    keys: [...input.keys],
  });
}

export async function runMoistureStressCadence(
  input: RunMoistureStressCadenceInput,
) {
  const scheduledWeatherDispatches = [];

  for (const target of input.targets) {
    const dispatch = await input.queue.enqueue({
      key: "weather.schedule-workspace-refresh",
      payload: {
        workspaceId: target.workspaceId,
        requestedAt: input.requestedAt,
        fieldIds: input.fieldId ? [input.fieldId] : undefined,
        limit: input.limit,
        forecastHours: input.forecastHours,
      },
    });

    scheduledWeatherDispatches.push({
      workspaceId: target.workspaceId,
      workspaceSlug: target.workspaceSlug,
      requestedAt: input.requestedAt,
      dispatch: toScheduledDispatchRecord(dispatch),
    });
  }

  const drainedWeatherDispatches = await drainMatchingWithRetry({
    queue: input.queue,
    limit: input.drainLimit,
    keys: MOISTURE_STRESS_WEATHER_JOB_KEYS,
    sleepFn: input.sleepFn,
  });

  const scheduledEstimateDispatches = [];

  for (const target of input.targets) {
    const dispatch = await input.queue.enqueue({
      key: "moisture.schedule-workspace-estimate-rebuild",
      payload: {
        workspaceId: target.workspaceId,
        requestedAt: input.requestedAt,
        fieldIds: input.fieldId ? [input.fieldId] : undefined,
        limit: input.limit,
      },
    });

    scheduledEstimateDispatches.push({
      workspaceId: target.workspaceId,
      workspaceSlug: target.workspaceSlug,
      requestedAt: input.requestedAt,
      dispatch: toScheduledDispatchRecord(dispatch),
    });
  }

  const drainedEstimateDispatches = await drainMatchingWithRetry({
    queue: input.queue,
    limit: input.drainLimit,
    keys: MOISTURE_STRESS_ESTIMATE_JOB_KEYS,
    sleepFn: input.sleepFn,
  });

  const scheduledMoistureStressDispatches = [];

  for (const target of input.targets) {
    const dispatch = await input.queue.enqueue({
      key: "intelligence.schedule-workspace-moisture-stress",
      payload: {
        workspaceId: target.workspaceId,
        requestedAt: input.requestedAt,
        fieldIds: input.fieldId ? [input.fieldId] : undefined,
        limit: input.limit,
      },
    });

    scheduledMoistureStressDispatches.push({
      workspaceId: target.workspaceId,
      workspaceSlug: target.workspaceSlug,
      requestedAt: input.requestedAt,
      dispatch: toScheduledDispatchRecord(dispatch),
    });
  }

  const drainedMoistureStressDispatches = await drainMatchingWithRetry({
    queue: input.queue,
    limit: input.drainLimit,
    keys: MOISTURE_STRESS_INTELLIGENCE_JOB_KEYS,
    sleepFn: input.sleepFn,
  });

  const summaries = await Promise.all(
    input.targets.map(async (target) => {
      const findings = await input.loadWorkspaceFindings({
        workspaceId: target.workspaceId,
        limit: input.reportLimit,
        status: "active",
        family: "moisture_stress",
        updatedAfter: input.requestedAt,
      });
      const activeFieldIds = new Set(findings.map((finding) => finding.fieldId));

      return {
        workspaceId: target.workspaceId,
        workspaceSlug: target.workspaceSlug,
        activeFindingCount: findings.length,
        activeFieldCount: activeFieldIds.size,
        topFindings: findings.slice(0, 10).map((finding) => ({
          fieldId: finding.fieldId,
          title: finding.title,
          severity: finding.severity,
          updatedAt: finding.updatedAt,
        })),
      } satisfies MoistureStressCadenceSummary;
    }),
  );

  return {
    requestedAt: input.requestedAt,
    scheduledWeatherDispatches,
    drainedWeatherDispatches,
    scheduledEstimateDispatches,
    drainedEstimateDispatches,
    scheduledMoistureStressDispatches,
    drainedMoistureStressDispatches,
    summaries,
  };
}

async function main() {
  loadWorkerEnv();
  const runtime = createServerRuntime(process.env);
  const queue = createWorkerJobQueue();
  const args = parseCliArgs();
  const asJson = readBooleanFlag(args, "json");
  const workspaceId = readStringFlag(args, "workspace-id");
  const fieldId = readStringFlag(args, "field-id");
  const limit = readNumberFlag(args, "limit");
  const requestedAt = readRequestedAt(
    readStringFlag(args, "requested-at"),
    "worker-moisture-stress-cadence",
  );
  const forecastHours = readNumberFlag(args, "forecast-hours");
  const drainLimit = readNumberFlag(args, "drain-limit") ?? 100;
  const reportLimit = readNumberFlag(args, "report-limit") ?? 50;

  if (runtime.mode !== "supabase") {
    throw new Error("Supabase runtime is not configured");
  }

  if (fieldId && !workspaceId) {
    throw new Error(
      "[worker-moisture-stress-cadence] --field-id requires --workspace-id",
    );
  }

  const targets = await resolveWorkspaceDispatchTargets({
    runtime,
    workspaceId,
    label: "worker-moisture-stress-cadence",
  });

  const result = await runMoistureStressCadence({
    queue,
    targets,
    requestedAt,
    workspaceId,
    fieldId,
    limit,
    forecastHours,
    drainLimit,
    reportLimit,
    loadWorkspaceFindings: (input) =>
      runtime.services.intelligence.loadWorkspaceFindings(input),
  });

  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.scheduledWeatherDispatches.length > 0) {
    console.log("Queued weather refresh jobs");
    console.table(
      formatDispatchTableRows(
        result.scheduledWeatherDispatches.map((entry) => ({
          ...(entry.dispatch as Parameters<typeof formatDispatchTableRows>[0][number]),
          workspaceId: entry.workspaceId,
        })),
      ),
    );
  }

  if (result.scheduledEstimateDispatches.length > 0) {
    console.log("\nQueued moisture estimate rebuild jobs");
    console.table(
      formatDispatchTableRows(
        result.scheduledEstimateDispatches.map((entry) => ({
          ...(entry.dispatch as Parameters<typeof formatDispatchTableRows>[0][number]),
          workspaceId: entry.workspaceId,
        })),
      ),
    );
  }

  if (result.scheduledMoistureStressDispatches.length > 0) {
    console.log("\nQueued moisture stress jobs");
    console.table(
      formatDispatchTableRows(
        result.scheduledMoistureStressDispatches.map((entry) => ({
          ...(entry.dispatch as Parameters<typeof formatDispatchTableRows>[0][number]),
          workspaceId: entry.workspaceId,
        })),
      ),
    );
  }

  console.log(
    [
      "",
      "Moisture stress cadence summary",
      `Requested at: ${result.requestedAt}`,
      `Weather keys: ${MOISTURE_STRESS_WEATHER_JOB_KEYS.join(", ")}`,
      `Estimate keys: ${MOISTURE_STRESS_ESTIMATE_JOB_KEYS.join(", ")}`,
      `Moisture-stress keys: ${MOISTURE_STRESS_INTELLIGENCE_JOB_KEYS.join(", ")}`,
      `Drained weather dispatches: ${result.drainedWeatherDispatches.length}`,
      `Drained estimate dispatches: ${result.drainedEstimateDispatches.length}`,
      `Drained moisture-stress dispatches: ${result.drainedMoistureStressDispatches.length}`,
      `Active moisture-stress findings: ${result.summaries.reduce((sum, entry) => sum + entry.activeFindingCount, 0)}`,
      `Active fields: ${result.summaries.reduce((sum, entry) => sum + entry.activeFieldCount, 0)}`,
    ].join("\n"),
  );

  if (result.summaries.length > 0) {
    console.log("\nWorkspace moisture stress summary");
    console.table(
      result.summaries.map((summary) => ({
        workspace: summary.workspaceSlug,
        activeFields: summary.activeFieldCount,
        activeFindings: summary.activeFindingCount,
      })),
    );
  }

  const activeFindings = result.summaries.flatMap((summary) =>
    summary.topFindings.map((finding) => ({
      workspace: summary.workspaceSlug,
      fieldId: finding.fieldId,
      title: finding.title,
      severity: finding.severity,
      updatedAt: finding.updatedAt,
    })),
  );

  if (activeFindings.length > 0) {
    console.log("\nRecent active moisture-stress findings");
    console.table(activeFindings.slice(0, 20));
  }
}

const executedAsScript =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (executedAsScript) {
  void main().catch((error: unknown) => {
    const message = describeCliError(
      error,
      "Unknown moisture stress cadence failure",
    );
    console.error(`[worker-moisture-stress-cadence] ${message}`);
    process.exitCode = 1;
  });
}
