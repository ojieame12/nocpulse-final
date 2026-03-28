import type { ImagerySyncReport } from "@fieldpulse/module-imagery";
import type {
  JobDispatchResult,
  JobKey,
  PersistentJobDispatchRecord,
} from "@fieldpulse/platform-jobs";
import { pathToFileURL } from "node:url";
import { formatDispatchTableRows } from "./runtime/jobCliFilters";
import {
  parseCliArgs,
  readBooleanFlag,
  readCsvFlag,
  readNumberFlag,
  readStringFlag,
} from "./runtime/parseCliArgs";
import { readRequestedAt } from "./runtime/readRequestedAt";

export const IMAGERY_CADENCE_JOB_KEYS = [
  "imagery.schedule-workspace-sync",
  "imagery.sync-latest",
] as const;

export type ImageryCadenceTarget = {
  workspaceId: string;
  workspaceSlug: string;
};

export type ImageryCadenceReport = ImagerySyncReport;

export type ImageryCadenceDispatchRecord = {
  id: string;
  key: string;
  status: string;
  [key: string]: unknown;
};

export type ImageryCadenceQueue = {
  enqueue(input: {
    key: "imagery.schedule-workspace-sync";
    payload: {
      workspaceId: string;
      requestedAt: string;
      fieldIds?: readonly string[];
      limit?: number;
      dryRun: boolean;
      providers?: readonly string[];
    };
  }): Promise<JobDispatchResult>;
  recoverStaleDispatches(input: {
    limit: number;
    requestedBy: string;
  }): Promise<readonly PersistentJobDispatchRecord[]>;
  drainMatching(input: {
    limit: number;
    keys: readonly JobKey[];
  }): Promise<readonly JobDispatchResult[]>;
};

export type RunImageryCadenceInput = {
  queue: ImageryCadenceQueue;
  targets: readonly ImageryCadenceTarget[];
  requestedAt: string;
  workspaceId?: string;
  fieldId?: string;
  limit?: number;
  dryRun: boolean;
  providers: readonly string[];
  drainLimit: number;
  staleAfterHours: number;
  reportLimit: number;
  buildRecentSyncReport: (input: {
    workspaceId?: string;
    createdAfter: string;
    staleAfterHours: number;
    limit: number;
  }) => Promise<ImageryCadenceReport>;
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
    "[worker-imagery-cadence] persistent queue enqueue did not return a dispatch record",
  );
}

export async function drainScheduledImageryJobs(input: {
  queue: ImageryCadenceQueue;
  limit: number;
  sleepFn?: (ms: number) => Promise<void>;
}) {
  const drained = await input.queue.drainMatching({
    limit: input.limit,
    keys: [...IMAGERY_CADENCE_JOB_KEYS],
  });

  if (drained.length > 0) {
    return drained;
  }

  await (input.sleepFn ?? sleep)(350);

  return input.queue.drainMatching({
    limit: input.limit,
    keys: [...IMAGERY_CADENCE_JOB_KEYS],
  });
}

export async function recoverStaleImageryJobs(input: {
  queue: ImageryCadenceQueue;
  limit: number;
}) {
  return input.queue.recoverStaleDispatches({
    limit: input.limit,
    requestedBy: "worker-imagery-cadence",
  });
}

export async function runImageryCadence(
  input: RunImageryCadenceInput,
) {
  const scheduledDispatches = [];

  for (const target of input.targets) {
    const dispatch = await input.queue.enqueue({
      key: "imagery.schedule-workspace-sync",
      payload: {
        workspaceId: target.workspaceId,
        requestedAt: input.requestedAt,
        fieldIds: input.fieldId ? [input.fieldId] : undefined,
        limit: input.limit,
        dryRun: input.dryRun,
        providers: input.providers.length > 0 ? input.providers : undefined,
      },
    });

    scheduledDispatches.push({
      workspaceId: target.workspaceId,
      workspaceSlug: target.workspaceSlug,
      requestedAt: input.requestedAt,
      dispatch: toScheduledDispatchRecord(dispatch),
    });
  }

  const recoveredStaleDispatches = await recoverStaleImageryJobs({
    queue: input.queue,
    limit: input.drainLimit,
  });

  const drainedDispatches = await drainScheduledImageryJobs({
    queue: input.queue,
    limit: input.drainLimit,
    sleepFn: input.sleepFn,
  });

  const report = await input.buildRecentSyncReport({
    workspaceId: input.workspaceId,
    createdAfter: input.requestedAt,
    staleAfterHours: input.staleAfterHours,
    limit: input.reportLimit,
  });

  return {
    requestedAt: input.requestedAt,
    scheduledDispatches,
    recoveredStaleDispatches,
    drainedDispatches,
    report,
  };
}

async function main() {
  const [{ createServerRuntime }, { loadWorkerEnv }, { createWorkerJobQueue }, { resolveWorkspaceDispatchTargets }] =
    await Promise.all([
      import("@fieldpulse/platform-runtime"),
      import("./runtime/loadEnv"),
      import("./runtime/createWorkerJobQueue"),
      import("./runtime/resolveWorkspaceDispatchTargets"),
    ]);

  loadWorkerEnv();
  const runtime = createServerRuntime(process.env);
  const queue = createWorkerJobQueue();
  const args = parseCliArgs();
  const asJson = readBooleanFlag(args, "json");
  const dryRun = readBooleanFlag(args, "dry-run");
  const workspaceId = readStringFlag(args, "workspace-id");
  const fieldId = readStringFlag(args, "field-id");
  const limit = readNumberFlag(args, "limit");
  const requestedAt = readRequestedAt(
    readStringFlag(args, "requested-at"),
    "worker-imagery-cadence",
  );
  const providers = readCsvFlag(args, "providers");
  const drainLimit = readNumberFlag(args, "drain-limit") ?? 50;
  const staleAfterHours = readNumberFlag(args, "stale-after-hours") ?? 24;
  const reportLimit = readNumberFlag(args, "report-limit") ?? 100;

  if (runtime.mode !== "supabase") {
    throw new Error("Supabase runtime is not configured");
  }

  if (fieldId && !workspaceId) {
    throw new Error(
      "[worker-imagery-cadence] --field-id requires --workspace-id",
    );
  }

  const targets = await resolveWorkspaceDispatchTargets({
    runtime,
    workspaceId,
    label: "worker-imagery-cadence",
  });

  const result = await runImageryCadence({
    queue,
    targets,
    requestedAt,
    workspaceId,
    fieldId,
    limit,
    dryRun,
    providers,
    drainLimit,
    staleAfterHours,
    reportLimit,
    buildRecentSyncReport: (reportInput) =>
      runtime.services.imagery.buildRecentSyncReport(reportInput),
  });

  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.scheduledDispatches.length > 0) {
    console.log("Queued imagery workspace sync jobs");
    console.table(
      formatDispatchTableRows(
        result.scheduledDispatches.map((entry) => ({
          ...(entry.dispatch as Parameters<typeof formatDispatchTableRows>[0][number]),
          workspaceId: entry.workspaceId,
        })),
      ),
    );
  }

  console.log(
    [
      "",
      "Imagery cadence summary",
      `Requested at: ${result.requestedAt}`,
      `Filtered keys: ${IMAGERY_CADENCE_JOB_KEYS.join(", ")}`,
      `Recovered stale dispatches: ${result.recoveredStaleDispatches.length}`,
      `Drained dispatches: ${result.drainedDispatches.length}`,
      `Capture rows scanned: ${result.report.scannedCaptureCount}`,
      `Refreshed fields: ${result.report.refreshedFieldCount}`,
      `Materialized fields: ${result.report.materializedFieldCount}`,
      `Unavailable fields: ${result.report.unavailableFieldCount}`,
      `Stale fields: ${result.report.staleFieldCount}`,
    ].join("\n"),
  );

  if (result.report.workspaceSummaries.length > 0) {
    console.log("\nWorkspace/provider imagery summary");
    console.table(
      result.report.workspaceSummaries.map((summary) => ({
        workspace: summary.workspaceSlug ?? summary.workspaceId,
        provider: summary.providerKey,
        captures: summary.captureCount,
        refreshedFields: summary.refreshedFieldCount,
        materializedFields: summary.materializedFieldCount,
        unavailableFields: summary.unavailableFieldCount,
        latestRequestedAt: summary.latestRequestedAt ?? "",
      })),
    );
  }

  if (result.report.fieldIssues.length > 0) {
    console.log("\nImagery field issues");
    console.table(
      result.report.fieldIssues.slice(0, 20).map((field) => ({
        workspace: field.workspaceSlug ?? field.workspaceId,
        field: field.fieldName ?? field.fieldId,
        issueType: field.issueType,
        lastProvider: field.lastProviderKey ?? "",
        lastStatus: field.lastStatus ?? "",
        lastRequestedAt: field.lastRequestedAt ?? "",
      })),
    );
  }
}

const executedAsScript =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (executedAsScript) {
  void main().catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : "Unknown imagery cadence failure";
    console.error(`[worker-imagery-cadence] ${message}`);
    process.exitCode = 1;
  });
}
