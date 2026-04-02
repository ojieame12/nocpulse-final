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
import {
  ACTION_BRIEF_INTELLIGENCE_JOB_KEYS,
  ACTION_BRIEF_WEATHER_JOB_KEYS,
  runActionBriefCadence,
} from "./actionBriefCadence.shared";

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
    "worker-action-brief-cadence",
  );
  const forecastHours = readNumberFlag(args, "forecast-hours");
  const drainLimit = readNumberFlag(args, "drain-limit") ?? 100;
  const reportLimit = readNumberFlag(args, "report-limit") ?? 50;

  if (runtime.mode !== "supabase") {
    throw new Error("Supabase runtime is not configured");
  }

  if (fieldId && !workspaceId) {
    throw new Error(
      "[worker-action-brief-cadence] --field-id requires --workspace-id",
    );
  }

  const targets = await resolveWorkspaceDispatchTargets({
    runtime,
    workspaceId,
    label: "worker-action-brief-cadence",
  });

  const result = await runActionBriefCadence({
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

  if (result.scheduledActionBriefDispatches.length > 0) {
    console.log("\nQueued action brief jobs");
    console.table(
      formatDispatchTableRows(
        result.scheduledActionBriefDispatches.map((entry) => ({
          ...(entry.dispatch as Parameters<typeof formatDispatchTableRows>[0][number]),
          workspaceId: entry.workspaceId,
        })),
      ),
    );
  }

  console.log(
    [
      "",
      "Action brief cadence summary",
      `Requested at: ${result.requestedAt}`,
      `Weather keys: ${ACTION_BRIEF_WEATHER_JOB_KEYS.join(", ")}`,
      `Action brief keys: ${ACTION_BRIEF_INTELLIGENCE_JOB_KEYS.join(", ")}`,
      `Drained weather dispatches: ${result.drainedWeatherDispatches.length}`,
      `Drained action brief dispatches: ${result.drainedActionBriefDispatches.length}`,
      `Active action brief findings: ${result.summaries.reduce((sum, entry) => sum + entry.activeFindingCount, 0)}`,
      `Active fields: ${result.summaries.reduce((sum, entry) => sum + entry.activeFieldCount, 0)}`,
    ].join("\n"),
  );

  if (result.summaries.length > 0) {
    console.log("\nWorkspace action brief summary");
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
    console.log("\nRecent active action brief findings");
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
      "Unknown action brief cadence failure",
    );
    console.error(`[worker-action-brief-cadence] ${message}`);
    process.exitCode = 1;
  });
}
