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
      throw new Error(`[worker-imagery-probe-report] invalid --created-after value "${explicit}"`);
    }

    return parsed.toISOString();
  }

  const sinceHours = readNumberFlag(args, "since-hours");

  if (sinceHours == null) {
    return undefined;
  }

  if (sinceHours < 0) {
    throw new Error("[worker-imagery-probe-report] --since-hours must be non-negative");
  }

  return new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();
}

async function main() {
  loadWorkerEnv();
  const runtime = createServerRuntime(process.env);
  const args = parseCliArgs();
  const asJson = readBooleanFlag(args, "json");
  const createdAfter = resolveCreatedAfter(args);
  const limit = readNumberFlag(args, "limit");

  if (runtime.mode !== "supabase") {
    throw new Error("Supabase runtime is not configured");
  }

  const report = await runtime.services.imagery.buildRecentProbeFallbackReport({
    createdAfter,
    limit,
  });

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(
    [
      `Generated: ${report.generatedAt}`,
      `Window start: ${report.createdAfter ?? "all-time"}`,
      `Probe rows scanned: ${report.totalRecordCount}`,
      `Fallback rows: ${report.fallbackRecordCount}`,
      `Affected fields: ${report.affectedFieldCount}`,
      `Cached quality reuse hits: ${report.cachedQualityReuseHitCount}`,
    ].join("\n"),
  );

  if (report.providerSummaries.length === 0) {
    console.log("\nNo fallback probe records matched the current window.");
    return;
  }

  console.log("\nProvider fallback summary");
  console.table(
    report.providerSummaries.map((summary) => ({
      provider: summary.provider,
      records: summary.recordCount,
      affectedFields: summary.affectedFieldCount,
      fallbackScenes: summary.fallbackSceneCount,
      noScene: summary.noSceneCount,
      errors: summary.errorCount,
      providerFallbacks: summary.providerFallbackCount,
      cachedQualityReuseHits: summary.cachedQualityReuseHitCount,
      latestCreatedAt: summary.latestCreatedAt ?? "",
      reasons: summary.reasons.join(" | "),
    })),
  );

  console.log("\nLatest field issues");
  console.table(
    report.fieldIssues.slice(0, 20).map((issue) => ({
      workspace: issue.workspaceSlug ?? issue.workspaceId,
      field: issue.fieldName ?? issue.fieldId,
      provider: issue.provider,
      providerStatus: issue.providerStatus,
      probeStatus: issue.probeStatus,
      cachedQualityReuseHit: issue.cachedQualityReuseHit,
      requestedAt: issue.requestedAt,
      createdAt: issue.createdAt,
      reason: issue.reason ?? "",
    })),
  );
}

void main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Unknown imagery probe report failure";
  console.error(`[worker-imagery-probe-report] ${message}`);
  process.exitCode = 1;
});
