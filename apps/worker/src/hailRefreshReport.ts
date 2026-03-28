import { createServerRuntime } from "@fieldpulse/platform-runtime";
import { loadWorkerEnv } from "./runtime/loadEnv";
import {
  parseCliArgs,
  readBooleanFlag,
  readNumberFlag,
  readStringFlag,
} from "./runtime/parseCliArgs";

function resolveRequestedAfter(args: ReturnType<typeof parseCliArgs>) {
  const explicit = readStringFlag(args, "requested-after");

  if (explicit) {
    const parsed = new Date(explicit);

    if (Number.isNaN(parsed.getTime())) {
      throw new Error(
        `[worker-hail-refresh-report] invalid --requested-after value "${explicit}"`,
      );
    }

    return parsed.toISOString();
  }

  const sinceHours = readNumberFlag(args, "since-hours");

  if (sinceHours == null) {
    return undefined;
  }

  if (sinceHours < 0) {
    throw new Error("[worker-hail-refresh-report] --since-hours must be non-negative");
  }

  return new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();
}

async function main() {
  loadWorkerEnv();
  const runtime = createServerRuntime(process.env);
  const args = parseCliArgs();
  const asJson = readBooleanFlag(args, "json");
  const workspaceId = readStringFlag(args, "workspace-id");
  const requestedAfter = resolveRequestedAfter(args);
  const staleAfterHours = readNumberFlag(args, "stale-after-hours");
  const limit = readNumberFlag(args, "limit");

  if (runtime.mode !== "supabase") {
    throw new Error("Supabase runtime is not configured");
  }

  const report = await runtime.services.hail.buildRecentRefreshReport({
    workspaceId,
    requestedAfter,
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
      `Requested after: ${report.requestedAfter ?? "all-time"}`,
      `Stale before: ${report.staleBefore}`,
      `Refresh runs scanned: ${report.scannedRunCount}`,
      `Refreshed fields: ${report.refreshedFieldCount}`,
      `Matched fields: ${report.matchedFieldCount}`,
      `No-signal fields: ${report.noSignalFieldCount}`,
      `Stale fields: ${report.staleFieldCount}`,
    ].join("\n"),
  );

  if (report.workspaceSummaries.length > 0) {
    console.log("\nWorkspace/provider hail refresh summary");
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
      report.matchedFields.slice(0, 30).map((field) => ({
        workspace: field.workspaceSlug ?? field.workspaceId,
        field: field.fieldName ?? field.fieldId,
        provider: field.providerKey,
        requestedAt: field.requestedAt,
        matchedEvents: field.matchedEventCount,
        latestMatchedReportedAt: field.latestMatchedReportedAt ?? "",
      })),
    );
  }

  if (report.noSignalFields.length > 0) {
    console.log("\nRecent no-signal hail fields");
    console.table(
      report.noSignalFields.slice(0, 30).map((field) => ({
        workspace: field.workspaceSlug ?? field.workspaceId,
        field: field.fieldName ?? field.fieldId,
        provider: field.providerKey,
        requestedAt: field.requestedAt,
      })),
    );
  }

  if (report.staleFields.length === 0) {
    console.log("\nNo stale hail refresh fields matched the current window.");
    return;
  }

  console.log("\nStale hail refresh fields");
  console.table(
    report.staleFields.slice(0, 30).map((field) => ({
      workspace: field.workspaceSlug ?? field.workspaceId,
      field: field.fieldName ?? field.fieldId,
      issueType: field.issueType,
      lastRequestedAt: field.lastRequestedAt ?? "",
      ageHours: field.ageHours ?? "",
      lastStatus: field.lastStatus ?? "",
      lastMatchedEvents: field.lastMatchedEventCount ?? "",
    })),
  );
}

void main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Unknown hail refresh report failure";
  console.error(`[worker-hail-refresh-report] ${message}`);
  process.exitCode = 1;
});
