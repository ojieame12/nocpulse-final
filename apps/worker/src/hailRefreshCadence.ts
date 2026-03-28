import { createServerRuntime } from "@fieldpulse/platform-runtime";
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

const HAIL_CADENCE_JOB_KEYS = [
  "hail.schedule-workspace-refresh",
  "hail.refresh-field",
] as const;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function drainScheduledHailJobs(input: {
  queue: ReturnType<typeof createWorkerJobQueue>;
  limit: number;
}) {
  const drained = await input.queue.drainMatching({
    limit: input.limit,
    keys: [...HAIL_CADENCE_JOB_KEYS],
  });

  if (drained.length > 0) {
    return drained;
  }

  // Freshly queued rows can land a few milliseconds ahead of the immediate
  // claim window. Retry once so the cadence command behaves like the manual
  // schedule -> drain sequence.
  await sleep(350);

  return input.queue.drainMatching({
    limit: input.limit,
    keys: [...HAIL_CADENCE_JOB_KEYS],
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
    "worker-hail-refresh-cadence",
  );
  const drainLimit = readNumberFlag(args, "drain-limit") ?? 50;
  const staleAfterHours = readNumberFlag(args, "stale-after-hours") ?? 24;
  const reportLimit = readNumberFlag(args, "report-limit") ?? 50;

  if (runtime.mode !== "supabase") {
    throw new Error("Supabase runtime is not configured");
  }

  if (fieldId && !workspaceId) {
    throw new Error(
      "[worker-hail-refresh-cadence] --field-id requires --workspace-id",
    );
  }

  const targets = await resolveWorkspaceDispatchTargets({
    runtime,
    workspaceId,
    label: "worker-hail-refresh-cadence",
  });

  const scheduledDispatches = [];

  for (const target of targets) {
    const dispatch = await queue.enqueue({
      key: "hail.schedule-workspace-refresh",
      payload: {
        workspaceId: target.workspaceId,
        requestedAt,
        fieldIds: fieldId ? [fieldId] : undefined,
        limit,
      },
    });

    scheduledDispatches.push({
      workspaceId: target.workspaceId,
      workspaceSlug: target.workspaceSlug,
      requestedAt,
      dispatch:
        dispatch.result && typeof dispatch.result === "object" && "id" in dispatch.result
          ? dispatch.result
          : dispatch,
    });
  }

  const drainedDispatches = await drainScheduledHailJobs({
    queue,
    limit: drainLimit,
  });

  const report = await runtime.services.hail.buildRecentRefreshReport({
    workspaceId,
    requestedAfter: requestedAt,
    staleAfterHours,
    limit: reportLimit,
  });

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          requestedAt,
          scheduledDispatches,
          drainedDispatches,
          report,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (scheduledDispatches.length > 0) {
    console.log("Queued hail workspace refresh jobs");
    console.table(
      formatDispatchTableRows(
        scheduledDispatches.map((entry) => ({
          ...(entry.dispatch as Parameters<typeof formatDispatchTableRows>[0][number]),
          workspaceId: entry.workspaceId,
        })),
      ),
    );
  }

  console.log(
    [
      "",
      "Hail cadence summary",
      `Requested at: ${requestedAt}`,
      `Filtered keys: ${HAIL_CADENCE_JOB_KEYS.join(", ")}`,
      `Drained dispatches: ${drainedDispatches.length}`,
      `Refresh runs scanned: ${report.scannedRunCount}`,
      `Refreshed fields: ${report.refreshedFieldCount}`,
      `Matched fields: ${report.matchedFieldCount}`,
      `No-signal fields: ${report.noSignalFieldCount}`,
      `Stale fields: ${report.staleFieldCount}`,
    ].join("\n"),
  );

  if (report.workspaceSummaries.length > 0) {
    console.log("\nWorkspace/provider hail summary");
    console.table(
      report.workspaceSummaries.map((summary) => ({
        workspace: summary.workspaceSlug ?? summary.workspaceId,
        provider: summary.providerKey,
        refreshedFields: summary.refreshedFieldCount,
        matchedFields: summary.matchedFieldCount,
        noSignalFields: summary.noSignalFieldCount,
        matchedEvents: summary.matchedEventCount,
        latestRequestedAt: summary.latestRequestedAt ?? "",
      })),
    );
  }

  if (report.matchedFields.length > 0) {
    console.log("\nRecent matched hail fields");
    console.table(
      report.matchedFields.slice(0, 20).map((field) => ({
        workspace: field.workspaceSlug ?? field.workspaceId,
        field: field.fieldName ?? field.fieldId,
        matchedEvents: field.matchedEventCount,
        requestedAt: field.requestedAt,
      })),
    );
  }

  if (report.noSignalFields.length > 0) {
    console.log("\nRecent no-signal hail fields");
    console.table(
      report.noSignalFields.slice(0, 20).map((field) => ({
        workspace: field.workspaceSlug ?? field.workspaceId,
        field: field.fieldName ?? field.fieldId,
        provider: field.providerKey,
        requestedAt: field.requestedAt,
      })),
    );
  }

  if (report.staleFields.length > 0) {
    console.log("\nStale hail fields");
    console.table(
      report.staleFields.slice(0, 20).map((field) => ({
        workspace: field.workspaceSlug ?? field.workspaceId,
        field: field.fieldName ?? field.fieldId,
        issueType: field.issueType,
        lastRequestedAt: field.lastRequestedAt ?? "",
        lastStatus: field.lastStatus ?? "",
      })),
    );
  }
}

void main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Unknown hail refresh cadence failure";
  console.error(`[worker-hail-refresh-cadence] ${message}`);
  process.exitCode = 1;
});
