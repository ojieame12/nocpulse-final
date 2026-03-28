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
  const reportDate = readStringFlag(args, "report-date");
  const forecastLimit = readNumberFlag(args, "forecast-limit");
  const alertLimit = readNumberFlag(args, "alert-limit");
  const findingLimit = readNumberFlag(args, "finding-limit");
  const zoneLimit = readNumberFlag(args, "zone-limit");

  if (!workspaceId) {
    throw new Error("[worker-field-report-read-model] --workspace-id is required");
  }

  if (!fieldId) {
    throw new Error("[worker-field-report-read-model] --field-id is required");
  }

  if (runtime.mode !== "supabase") {
    throw new Error("Supabase runtime is not configured");
  }

  const model = await runtime.services.reports.buildFieldReadModel({
    workspaceId,
    fieldId,
    reportDate,
    forecastLimit,
    alertLimit,
    findingLimit,
    zoneLimit,
  });

  if (asJson) {
    console.log(JSON.stringify(model, null, 2));
    return;
  }

  console.log(
    [
      `Generated: ${model.generatedAt}`,
      `Field: ${model.field.name}`,
      `Crop: ${model.summary.cropType ?? "unknown"}`,
      `Stage: ${model.summary.growthStage ?? "unknown"}`,
      `Active alerts: ${model.summary.activeAlertCount}`,
      `Active findings: ${model.summary.activeFindingCount}`,
      `Tracked zones: ${model.summary.trackedZoneCount}`,
      `Active tracked zones: ${model.summary.activeTrackedZoneCount}`,
      `Moisture observed: ${model.summary.moistureObservedAt ?? "n/a"}`,
      `Weather observed: ${model.summary.weatherObservedAt ?? "n/a"}`,
    ].join("\n"),
  );
}

void main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Unknown field report read-model failure";
  console.error(`[worker-field-report-read-model] ${message}`);
  process.exitCode = 1;
});
