import { createServerRuntime } from "@fieldpulse/platform-runtime";
import type { JobKey } from "@fieldpulse/platform-jobs";
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

const WEATHER_CADENCE_JOB_KEYS = [
  "weather.schedule-workspace-refresh",
  "weather.refresh-field",
] as const;

const DISEASE_CADENCE_JOB_KEYS = [
  "intelligence.schedule-workspace-disease-risk",
  "intelligence.generate-disease-risk",
] as const;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function drainMatchingWithRetry(input: {
  queue: ReturnType<typeof createWorkerJobQueue>;
  limit: number;
  keys: readonly JobKey[];
}) {
  const drained = await input.queue.drainMatching({
    limit: input.limit,
    keys: [...input.keys],
  });

  if (drained.length > 0) {
    return drained;
  }

  await sleep(350);

  return input.queue.drainMatching({
    limit: input.limit,
    keys: [...input.keys],
  });
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
    "worker-disease-risk-cadence",
  );
  const forecastHours = readNumberFlag(args, "forecast-hours");
  const drainLimit = readNumberFlag(args, "drain-limit") ?? 100;
  const staleAfterHours = readNumberFlag(args, "stale-after-hours") ?? 24;
  const reportLimit = readNumberFlag(args, "report-limit") ?? 50;

  if (runtime.mode !== "supabase") {
    throw new Error("Supabase runtime is not configured");
  }

  if (fieldId && !workspaceId) {
    throw new Error(
      "[worker-disease-risk-cadence] --field-id requires --workspace-id",
    );
  }

  const targets = await resolveWorkspaceDispatchTargets({
    runtime,
    workspaceId,
    label: "worker-disease-risk-cadence",
  });

  const scheduledWeatherDispatches = [];

  for (const target of targets) {
    const dispatch = await queue.enqueue({
      key: "weather.schedule-workspace-refresh",
      payload: {
        workspaceId: target.workspaceId,
        requestedAt,
        fieldIds: fieldId ? [fieldId] : undefined,
        limit,
        forecastHours,
      },
    });

    scheduledWeatherDispatches.push({
      workspaceId: target.workspaceId,
      workspaceSlug: target.workspaceSlug,
      requestedAt,
      dispatch:
        dispatch.result && typeof dispatch.result === "object" && "id" in dispatch.result
          ? dispatch.result
          : dispatch,
    });
  }

  const drainedWeatherDispatches = await drainMatchingWithRetry({
    queue,
    limit: drainLimit,
    keys: WEATHER_CADENCE_JOB_KEYS,
  });

  const scheduledDiseaseDispatches = [];

  for (const target of targets) {
    const dispatch = await queue.enqueue({
      key: "intelligence.schedule-workspace-disease-risk",
      payload: {
        workspaceId: target.workspaceId,
        requestedAt,
        fieldIds: fieldId ? [fieldId] : undefined,
        limit,
      },
    });

    scheduledDiseaseDispatches.push({
      workspaceId: target.workspaceId,
      workspaceSlug: target.workspaceSlug,
      requestedAt,
      dispatch:
        dispatch.result && typeof dispatch.result === "object" && "id" in dispatch.result
          ? dispatch.result
          : dispatch,
    });
  }

  const drainedDiseaseDispatches = await drainMatchingWithRetry({
    queue,
    limit: drainLimit,
    keys: DISEASE_CADENCE_JOB_KEYS,
  });

  const report = await runtime.services.intelligence.buildRecentDiseaseRiskReport({
    workspaceId,
    startedAfter: requestedAt,
    staleAfterHours,
    limit: reportLimit,
  });

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          requestedAt,
          scheduledWeatherDispatches,
          drainedWeatherDispatches,
          scheduledDiseaseDispatches,
          drainedDiseaseDispatches,
          report,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (scheduledWeatherDispatches.length > 0) {
    console.log("Queued weather refresh jobs");
    console.table(
      formatDispatchTableRows(
        scheduledWeatherDispatches.map((entry) => ({
          ...(entry.dispatch as Parameters<typeof formatDispatchTableRows>[0][number]),
          workspaceId: entry.workspaceId,
        })),
      ),
    );
  }

  if (scheduledDiseaseDispatches.length > 0) {
    console.log("\nQueued disease risk jobs");
    console.table(
      formatDispatchTableRows(
        scheduledDiseaseDispatches.map((entry) => ({
          ...(entry.dispatch as Parameters<typeof formatDispatchTableRows>[0][number]),
          workspaceId: entry.workspaceId,
        })),
      ),
    );
  }

  console.log(
    [
      "",
      "Disease risk cadence summary",
      `Requested at: ${requestedAt}`,
      `Weather keys: ${WEATHER_CADENCE_JOB_KEYS.join(", ")}`,
      `Disease keys: ${DISEASE_CADENCE_JOB_KEYS.join(", ")}`,
      `Drained weather dispatches: ${drainedWeatherDispatches.length}`,
      `Drained disease dispatches: ${drainedDiseaseDispatches.length}`,
      `Runs scanned: ${report.scannedRunCount}`,
      `Refreshed fields: ${report.refreshedFieldCount}`,
      `Active findings: ${report.activeFindingCount}`,
      `Active fields: ${report.activeFieldCount}`,
      `No-signal fields: ${report.noSignalFieldCount}`,
      `Stale fields: ${report.staleFieldCount}`,
    ].join("\n"),
  );

  if (report.workspaceSummaries.length > 0) {
    console.log("\nWorkspace disease risk summary");
    console.table(
      report.workspaceSummaries.map((summary) => ({
        workspace: summary.workspaceSlug ?? summary.workspaceId,
        refreshedFields: summary.refreshedFieldCount,
        activeFields: summary.activeFieldCount,
        activeFindings: summary.activeFindingCount,
        noSignalFields: summary.noSignalFieldCount,
        latestRunStartedAt: summary.latestRunStartedAt ?? "",
      })),
    );
  }

  if (report.activeFields.length > 0) {
    console.log("\nActive disease-risk fields");
    console.table(
      report.activeFields.slice(0, 20).map((field) => ({
        workspace: field.workspaceSlug ?? field.workspaceId,
        field: field.fieldName ?? field.fieldId,
        severity: field.severity,
        diseaseModelKey: field.diseaseModelKey ?? "",
        title: field.title,
        updatedAt: field.updatedAt,
      })),
    );
  }

  if (report.noSignalFields.length > 0) {
    console.log("\nRecent no-signal disease fields");
    console.table(
      report.noSignalFields.slice(0, 20).map((field) => ({
        workspace: field.workspaceSlug ?? field.workspaceId,
        field: field.fieldName ?? field.fieldId,
        latestRunStartedAt: field.latestRunStartedAt,
      })),
    );
  }

  if (report.staleFields.length > 0) {
    console.log("\nStale disease-risk fields");
    console.table(
      report.staleFields.slice(0, 20).map((field) => ({
        workspace: field.workspaceSlug ?? field.workspaceId,
        field: field.fieldName ?? field.fieldId,
        issueType: field.issueType,
        lastRunStartedAt: field.lastRunStartedAt ?? "",
        lastStatus: field.lastRunStatus ?? "",
      })),
    );
  }
}

void main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Unknown disease risk cadence failure";
  console.error(`[worker-disease-risk-cadence] ${message}`);
  process.exitCode = 1;
});
