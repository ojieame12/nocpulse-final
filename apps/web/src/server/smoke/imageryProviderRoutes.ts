import { loadEnvFile } from "@fieldpulse/platform-config";
import { createServerRuntime } from "@fieldpulse/platform-runtime";
import { GET as getProviders } from "../../app/api/imagery/providers/route";
import {
  GET as getProbeHistory,
  POST as postProbeHistory,
} from "../../app/api/imagery/providers/probes/route";

const FALLBACK_ACTOR_USER_ID = "00000000-0000-4000-8000-000000000001";

async function main() {
  loadEnvFile();
  const runtime = createServerRuntime(process.env);

  if (runtime.mode !== "supabase") {
    throw new Error("Supabase runtime is not configured");
  }

  const actorUserId = runtime.env.devActorUserId ?? FALLBACK_ACTOR_USER_ID;
  const workspace = (await runtime.services.workspaces.listForUser(actorUserId))[0];

  if (!workspace) {
    throw new Error(`No workspace is available for actor ${actorUserId}`);
  }

  const fieldOverview = await runtime.services.catalog.loadWorkspaceFieldOverview({
    actorUserId,
    preferredWorkspaceId: workspace.id,
  });
  const field = fieldOverview.primaryField;

  if (!field) {
    throw new Error(`No field is available in workspace ${workspace.id}`);
  }

  const headers = {
    "x-fieldpulse-user-id": actorUserId,
    "x-fieldpulse-workspace-id": workspace.id,
  };

  const globalResponse = await getProviders(
    new Request("http://localhost/api/imagery/providers", {
      headers,
    }),
  );
  const globalJson = await globalResponse.json();

  const liveFieldResponse = await getProviders(
    new Request(
      `http://localhost/api/imagery/providers?fieldId=${encodeURIComponent(field.id)}`,
      {
        headers,
      },
    ),
  );
  const liveFieldJson = await liveFieldResponse.json();

  const recordResponse = await postProbeHistory(
    new Request(
      `http://localhost/api/imagery/providers/probes?fieldId=${encodeURIComponent(field.id)}`,
      {
        method: "POST",
        headers: {
          ...headers,
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      },
    ),
  );
  const recordJson = await recordResponse.json();

  const historyResponse = await getProbeHistory(
    new Request(
      `http://localhost/api/imagery/providers/probes?fieldId=${encodeURIComponent(field.id)}&limit=5`,
      {
        headers,
      },
    ),
  );
  const historyJson = await historyResponse.json();

  console.log(
    JSON.stringify(
      {
        workspaceId: workspace.id,
        fieldId: field.id,
        globalStatus: globalResponse.status,
        globalProviderCount: globalJson.diagnostics?.length ?? 0,
        liveFieldStatus: liveFieldResponse.status,
        liveFieldPlanetProbeStatus:
          liveFieldJson.diagnostics?.find(
            (entry: { provider: string }) => entry.provider === "planet",
          )?.probe?.status ?? null,
        recordStatus: recordResponse.status,
        recordedCount: recordJson.records?.length ?? 0,
        historyStatus: historyResponse.status,
        historyCount: historyJson.records?.length ?? 0,
      },
      null,
      2,
    ),
  );
}

void main().catch((error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : "Unknown imagery provider route smoke error";
  console.error(`[imagery-provider-routes-smoke] ${message}`);
  process.exitCode = 1;
});
