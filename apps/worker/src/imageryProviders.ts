import type {
  ImageryProviderDiagnostics,
  ImageryProviderFieldDiagnostics,
} from "@fieldpulse/module-imagery";
import { createServerRuntime } from "@fieldpulse/platform-runtime";
import { loadWorkerEnv } from "./runtime/loadEnv";
import {
  parseCliArgs,
  readBooleanFlag,
  readStringFlag,
} from "./runtime/parseCliArgs";

function hasProbe(
  diagnostic: ImageryProviderDiagnostics | ImageryProviderFieldDiagnostics,
): diagnostic is ImageryProviderFieldDiagnostics {
  return "probe" in diagnostic;
}

async function main() {
  loadWorkerEnv();
  const runtime = createServerRuntime(process.env);
  const args = parseCliArgs();
  const asJson = readBooleanFlag(args, "json");
  const workspaceId = readStringFlag(args, "workspace-id");
  const fieldId = readStringFlag(args, "field-id");
  const requestedAt = readStringFlag(args, "requested-at");

  if (runtime.mode !== "supabase") {
    throw new Error("Supabase runtime is not configured");
  }

  if ((workspaceId && !fieldId) || (!workspaceId && fieldId)) {
    throw new Error(
      "[worker-imagery-providers] --workspace-id and --field-id must be provided together",
    );
  }

  const diagnostics =
    workspaceId && fieldId
      ? await runtime.services.imagery.inspectProvidersForField({
          workspaceId,
          fieldId,
          requestedAt,
        })
      : await runtime.services.imagery.inspectProviders();

  if (asJson) {
    console.log(JSON.stringify(diagnostics, null, 2));
    return;
  }

  console.table(
    diagnostics.map((diagnostic) => ({
      provider: diagnostic.provider,
      status: diagnostic.status,
      discoveryMode: diagnostic.discoveryMode,
      materializationMode: diagnostic.materializationMode,
      discoveryClient: diagnostic.discoveryClient ?? "",
      materializationClient: diagnostic.materializationClient ?? "",
      fallbackClient: diagnostic.fallbackClient ?? "",
      reason: diagnostic.reason ?? "",
      probeStatus: hasProbe(diagnostic) ? diagnostic.probe.status : "",
      probeDiscoveryMode:
        hasProbe(diagnostic) ? diagnostic.probe.discoveryMode ?? "" : "",
      probeSceneKey: hasProbe(diagnostic) ? diagnostic.probe.sceneKey ?? "" : "",
      probeReason: hasProbe(diagnostic) ? diagnostic.probe.reason ?? "" : "",
    })),
  );
}

void main().catch((error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : "Unknown imagery provider diagnostics failure";
  console.error(`[worker-imagery-providers] ${message}`);
  process.exitCode = 1;
});
