import type { FieldBoundary } from "@fieldpulse/module-fields";
import { loadEnvFile } from "@fieldpulse/platform-config";
import { createServerRuntime } from "@fieldpulse/platform-runtime";

const FALLBACK_ACTOR_USER_ID = "00000000-0000-4000-8000-000000000001";
const DEMO_WORKSPACE_SLUG = "fieldpulse-dev-farm";
const DEMO_WORKSPACE_NAME = "FieldPulse Dev Farm";
const DEMO_FIELD_NAME = "North Quarter Demo";

function createDemoBoundary(): FieldBoundary {
  return {
    type: "MultiPolygon",
    coordinates: [
      [[
        [-104.6635, 50.4585],
        [-104.6505, 50.4585],
        [-104.6505, 50.448],
        [-104.6635, 50.448],
        [-104.6635, 50.4585],
      ]],
    ],
  };
}

async function main() {
  const envPath = loadEnvFile();
  const runtime = createServerRuntime(process.env);

  if (runtime.mode !== "supabase") {
    throw new Error(
      "Supabase runtime is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before bootstrapping dev data.",
    );
  }

  const actorUserId = runtime.env.devActorUserId ?? FALLBACK_ACTOR_USER_ID;
  const result = await runtime.services.development.bootstrapDevelopmentData({
    actorUserId,
    workspace: {
      name: DEMO_WORKSPACE_NAME,
      slug: DEMO_WORKSPACE_SLUG,
    },
    field: {
      name: DEMO_FIELD_NAME,
      areaHa: 48.6,
      boundary: createDemoBoundary(),
    },
    moistureSnapshot: {
      observedAt: new Date().toISOString(),
      sourceKey: "bootstrap:dev-seed",
      rootZonePct: 41.2,
      surfacePct: 34.8,
      confidence: "medium",
      inputs: {
        forecastModel: "bootstrap-dev",
        soilDataset: "bootstrap-dev",
      },
    },
  });

  console.log(
    JSON.stringify(
      {
        envPath,
        actorUserId: result.actorUserId,
        workspace: {
          id: result.workspace.workspace.id,
          slug: result.workspace.workspace.slug,
          action: result.workspace.action,
        },
        field: {
          id: result.field.field.id,
          name: result.field.field.name,
          action: result.field.action,
        },
        moistureSnapshot: {
          observedAt: result.moistureSnapshot.snapshot.observedAt,
          action: result.moistureSnapshot.action,
        },
        imageryObservation: result.imageryObservation,
        nextStep:
          "Start the web app and refresh the home page. Set DEV_WORKSPACE_ID or DEV_ACTOR_USER_ID in .env if you want a deterministic workspace selection.",
      },
      null,
      2,
    ),
  );
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown bootstrap error";
  console.error(`[bootstrap-dev-data] ${message}`);
  process.exitCode = 1;
});
