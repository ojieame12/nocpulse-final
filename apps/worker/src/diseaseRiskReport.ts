import { createServerRuntime } from "@fieldpulse/platform-runtime";
import { loadWorkerEnv } from "./runtime/loadEnv";
import {
  parseCliArgs,
  readBooleanFlag,
  readNumberFlag,
  readStringFlag,
} from "./runtime/parseCliArgs";

function resolveStartedAfter(args: ReturnType<typeof parseCliArgs>) {
  const explicit = readStringFlag(args, "started-after");

  if (explicit) {
    const parsed = new Date(explicit);

    if (Number.isNaN(parsed.getTime())) {
      throw new Error(
        `[worker-disease-risk-report] invalid --started-after value "${explicit}"`,
      );
    }

    return parsed.toISOString();
  }

  const sinceHours = readNumberFlag(args, "since-hours");

  if (sinceHours == null) {
    return undefined;
  }

  if (sinceHours < 0) {
    throw new Error("[worker-disease-risk-report] --since-hours must be non-negative");
  }

  return new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();
}

async function main() {
  loadWorkerEnv();
  const runtime = createServerRuntime(process.env);
  const args = parseCliArgs();
  const asJson = readBooleanFlag(args, "json");
  const workspaceId = readStringFlag(args, "workspace-id");
  const startedAfter = resolveStartedAfter(args);
  const staleAfterHours = readNumberFlag(args, "stale-after-hours");
  const limit = readNumberFlag(args, "limit");

  if (runtime.mode !== "supabase") {
    throw new Error("Supabase runtime is not configured");
  }

  const report = await runtime.services.intelligence.buildRecentDiseaseRiskReport({
    workspaceId,
    startedAfter,
    staleAfterHours,
    limit,
  });

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(
    [
      `Generated: ${report.generatedAt}`,
      `Started after: ${report.startedAfter ?? "all-time"}`,
      `Stale before: ${report.staleBefore}`,
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
      report.activeFields.slice(0, 30).map((field) => ({
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
      report.noSignalFields.slice(0, 30).map((field) => ({
        workspace: field.workspaceSlug ?? field.workspaceId,
        field: field.fieldName ?? field.fieldId,
        latestRunStartedAt: field.latestRunStartedAt,
        latestRunCompletedAt: field.latestRunCompletedAt ?? "",
      })),
    );
  }

  if (report.staleFields.length === 0) {
    console.log("\nNo stale disease-risk fields matched the current window.");
    return;
  }

  console.log("\nStale disease-risk fields");
  console.table(
    report.staleFields.slice(0, 30).map((field) => ({
      workspace: field.workspaceSlug ?? field.workspaceId,
      field: field.fieldName ?? field.fieldId,
      issueType: field.issueType,
      lastRunStartedAt: field.lastRunStartedAt ?? "",
      lastRunCompletedAt: field.lastRunCompletedAt ?? "",
      ageHours: field.ageHours ?? "",
      lastStatus: field.lastRunStatus ?? "",
    })),
  );
}

void main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Unknown disease risk report failure";
  console.error(`[worker-disease-risk-report] ${message}`);
  process.exitCode = 1;
});
