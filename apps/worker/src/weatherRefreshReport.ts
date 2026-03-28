import { createServerRuntime } from "@fieldpulse/platform-runtime";
import { loadWorkerEnv } from "./runtime/loadEnv";
import {
  parseCliArgs,
  readBooleanFlag,
  readNumberFlag,
  readStringFlag,
} from "./runtime/parseCliArgs";

function resolveUpdatedAfter(args: ReturnType<typeof parseCliArgs>) {
  const explicit = readStringFlag(args, "updated-after");

  if (explicit) {
    const parsed = new Date(explicit);

    if (Number.isNaN(parsed.getTime())) {
      throw new Error(
        `[worker-weather-refresh-report] invalid --updated-after value "${explicit}"`,
      );
    }

    return parsed.toISOString();
  }

  const sinceHours = readNumberFlag(args, "since-hours");

  if (sinceHours == null) {
    return undefined;
  }

  if (sinceHours < 0) {
    throw new Error("[worker-weather-refresh-report] --since-hours must be non-negative");
  }

  return new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();
}

async function main() {
  loadWorkerEnv();
  const runtime = createServerRuntime(process.env);
  const args = parseCliArgs();
  const asJson = readBooleanFlag(args, "json");
  const workspaceId = readStringFlag(args, "workspace-id");
  const updatedAfter = resolveUpdatedAfter(args);
  const staleAfterHours = readNumberFlag(args, "stale-after-hours");
  const limit = readNumberFlag(args, "limit");

  if (runtime.mode !== "supabase") {
    throw new Error("Supabase runtime is not configured");
  }

  const report = await runtime.services.weather.buildRecentRefreshReport({
    workspaceId,
    updatedAfter,
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
      `Updated after: ${report.updatedAfter ?? "all-time"}`,
      `Stale before: ${report.staleBefore}`,
      `Observation rows scanned: ${report.scannedObservationCount}`,
      `Refreshed fields: ${report.refreshedFieldCount}`,
      `Stale fields: ${report.staleFieldCount}`,
    ].join("\n"),
  );

  if (report.workspaceSummaries.length > 0) {
    console.log("\nWorkspace/provider refresh summary");
    console.table(
      report.workspaceSummaries.map((summary) => ({
        workspace: summary.workspaceSlug ?? summary.workspaceId,
        provider: summary.providerKey,
        refreshedObservations: summary.refreshedObservationCount,
        refreshedFields: summary.refreshedFieldCount,
        latestObservedAt: summary.latestObservedAt ?? "",
        latestUpdatedAt: summary.latestUpdatedAt ?? "",
      })),
    );
  }

  if (report.staleFields.length === 0) {
    console.log("\nNo stale weather fields matched the current window.");
    return;
  }

  console.log("\nStale weather fields");
  console.table(
    report.staleFields.slice(0, 30).map((field) => ({
      workspace: field.workspaceSlug ?? field.workspaceId,
      field: field.fieldName ?? field.fieldId,
      issueType: field.issueType,
      lastObservedAt: field.lastObservedAt ?? "",
      lastUpdatedAt: field.lastUpdatedAt ?? "",
      ageHours: field.ageHours ?? "",
    })),
  );
}

void main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Unknown weather refresh report failure";
  console.error(`[worker-weather-refresh-report] ${message}`);
  process.exitCode = 1;
});
