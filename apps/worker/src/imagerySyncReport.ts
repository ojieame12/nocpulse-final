import { createServerRuntime } from "@fieldpulse/platform-runtime";
import { loadWorkerEnv } from "./runtime/loadEnv";
import {
  parseCliArgs,
  readBooleanFlag,
  readNumberFlag,
  readStringFlag,
} from "./runtime/parseCliArgs";

function resolveCreatedAfter(args: ReturnType<typeof parseCliArgs>) {
  const explicit = readStringFlag(args, "created-after");

  if (explicit) {
    const parsed = new Date(explicit);

    if (Number.isNaN(parsed.getTime())) {
      throw new Error(
        `[worker-imagery-sync-report] invalid --created-after value "${explicit}"`,
      );
    }

    return parsed.toISOString();
  }

  const sinceHours = readNumberFlag(args, "since-hours");

  if (sinceHours == null) {
    return undefined;
  }

  if (sinceHours < 0) {
    throw new Error("[worker-imagery-sync-report] --since-hours must be non-negative");
  }

  return new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();
}

async function main() {
  loadWorkerEnv();
  const runtime = createServerRuntime(process.env);
  const args = parseCliArgs();
  const asJson = readBooleanFlag(args, "json");
  const workspaceId = readStringFlag(args, "workspace-id");
  const createdAfter = resolveCreatedAfter(args);
  const staleAfterHours = readNumberFlag(args, "stale-after-hours");
  const limit = readNumberFlag(args, "limit");

  if (runtime.mode !== "supabase") {
    throw new Error("Supabase runtime is not configured");
  }

  const report = await runtime.services.imagery.buildRecentSyncReport({
    workspaceId,
    createdAfter,
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
      `Created after: ${report.createdAfter ?? "all-time"}`,
      `Stale before: ${report.staleBefore}`,
      `Capture rows scanned: ${report.scannedCaptureCount}`,
      `Refreshed fields: ${report.refreshedFieldCount}`,
      `Materialized fields: ${report.materializedFieldCount}`,
      `Unavailable fields: ${report.unavailableFieldCount}`,
      `Stale fields: ${report.staleFieldCount}`,
    ].join("\n"),
  );

  if (report.workspaceSummaries.length > 0) {
    console.log("\nWorkspace/provider imagery summary");
    console.table(
      report.workspaceSummaries.map((summary) => ({
        workspace: summary.workspaceSlug ?? summary.workspaceId,
        provider: summary.providerKey,
        captures: summary.captureCount,
        refreshedFields: summary.refreshedFieldCount,
        materializedFields: summary.materializedFieldCount,
        unavailableFields: summary.unavailableFieldCount,
        latestRequestedAt: summary.latestRequestedAt ?? "",
        latestCapturedAt: summary.latestCapturedAt ?? "",
      })),
    );
  }

  if (report.fieldIssues.length === 0) {
    console.log("\nNo imagery field issues matched the current window.");
    return;
  }

  console.log("\nImagery field issues");
  console.table(
    report.fieldIssues.slice(0, 30).map((field) => ({
      workspace: field.workspaceSlug ?? field.workspaceId,
      field: field.fieldName ?? field.fieldId,
      issueType: field.issueType,
      lastProvider: field.lastProviderKey ?? "",
      lastStatus: field.lastStatus ?? "",
      lastRequestedAt: field.lastRequestedAt ?? "",
      lastCapturedAt: field.lastCapturedAt ?? "",
    })),
  );
}

void main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Unknown imagery sync report failure";
  console.error(`[worker-imagery-sync-report] ${message}`);
  process.exitCode = 1;
});
