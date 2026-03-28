import { createServerRuntime } from "@fieldpulse/platform-runtime";
import { loadWorkerEnv } from "./runtime/loadEnv";
import {
  parseCliArgs,
  readBooleanFlag,
  readNumberFlag,
  readStringFlag,
} from "./runtime/parseCliArgs";

async function main() {
  loadWorkerEnv();
  const runtime = createServerRuntime(process.env);
  const args = parseCliArgs();
  const asJson = readBooleanFlag(args, "json");
  const workspaceId = readStringFlag(args, "workspace-id");
  const fieldId = readStringFlag(args, "field-id");
  const family = readStringFlag(args, "family");
  const status = readStringFlag(args, "status");
  const limit = readNumberFlag(args, "limit");

  if (!workspaceId) {
    throw new Error("[worker-zone-activity-report] --workspace-id is required");
  }

  if (!fieldId) {
    throw new Error("[worker-zone-activity-report] --field-id is required");
  }

  if (runtime.mode !== "supabase") {
    throw new Error("Supabase runtime is not configured");
  }

  const report = await runtime.services.intelligence.buildFieldZoneActivityReport({
    workspaceId,
    fieldId,
    family: family as
      | "hail_risk"
      | "weather_risk"
      | "moisture_stress"
      | "crop_health"
      | "disease_risk"
      | "action_brief"
      | undefined,
    status: status as
      | "new"
      | "persistent"
      | "recovering"
      | "resolved"
      | undefined,
    limit,
  });

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(
    [
      `Generated: ${report.generatedAt}`,
      `Field: ${report.fieldId}`,
      `Total zones: ${report.totalZoneCount}`,
      `New: ${report.newZoneCount}`,
      `Persistent: ${report.persistentZoneCount}`,
      `Recovering: ${report.recoveringZoneCount}`,
      `Resolved: ${report.resolvedZoneCount}`,
    ].join("\n"),
  );

  if (report.familySummaries.length > 0) {
    console.log("\nFamily summaries");
    console.table(report.familySummaries);
  }

  if (report.zones.length === 0) {
    console.log("\nNo tracked zones matched the current filters.");
    return;
  }

  console.log("\nTracked zones");
  console.table(
    report.zones.map((zone) => ({
      id: zone.id,
      family: zone.family,
      status: zone.status,
      severity: zone.latestSeverity ?? "",
      detectionCount: zone.detectionCount,
      affectedCellCount: zone.affectedCellCount,
      lastSeenAt: zone.lastSeenAt,
      trackingKey: zone.trackingKey,
    })),
  );
}

void main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Unknown zone activity report failure";
  console.error(`[worker-zone-activity-report] ${message}`);
  process.exitCode = 1;
});
