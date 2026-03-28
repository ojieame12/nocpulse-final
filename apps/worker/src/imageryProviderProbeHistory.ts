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
  const record = readBooleanFlag(args, "record");
  const workspaceId = readStringFlag(args, "workspace-id");
  const fieldId = readStringFlag(args, "field-id");
  const requestedAt = readStringFlag(args, "requested-at");
  const limit = readNumberFlag(args, "limit");

  if (runtime.mode !== "supabase") {
    throw new Error("Supabase runtime is not configured");
  }

  if (!workspaceId || !fieldId) {
    throw new Error(
      "[worker-imagery-probe-history] --workspace-id and --field-id are required",
    );
  }

  const records = record
    ? await runtime.services.imagery.recordProviderProbeForField({
        workspaceId,
        fieldId,
        requestedAt,
      })
    : await runtime.services.imagery.listProviderProbeHistoryForField({
        workspaceId,
        fieldId,
        limit,
      });

  if (asJson) {
    console.log(JSON.stringify(records, null, 2));
    return;
  }

  console.table(
    records.map((record) => ({
      provider: record.provider,
      requestedAt: record.requestedAt,
      providerStatus: record.providerStatus,
      probeStatus: record.probeStatus,
      discoveryMode: record.discoveryMode,
      probeDiscoveryMode: record.probeDiscoveryMode ?? "",
      cachedQualityReuseHit: record.details.probeCachedQualityReuseHit === true,
      sceneKey: record.probeSceneKey ?? "",
      reason: record.probeReason ?? record.reason ?? "",
      createdAt: record.createdAt,
    })),
  );
}

void main().catch((error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : "Unknown imagery provider probe history failure";
  console.error(`[worker-imagery-probe-history] ${message}`);
  process.exitCode = 1;
});
