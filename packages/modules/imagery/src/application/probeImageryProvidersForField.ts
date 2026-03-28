import type { RasterMultiPolygon } from "@fieldpulse/raster";
import type { EntityId, TimestampIso, WorkspaceId } from "@fieldpulse/platform-db";
import type {
  ImageryProviderDiagnostics,
  ImageryProviderFieldDiagnostics,
  ImageryProviderFieldProbe,
} from "../contracts/ImageryProviderDiagnostics";
import type { ImageryProviderClient } from "../contracts/ImageryProviderClient";

export type ProbeImageryProvidersForFieldInput = {
  workspaceId: WorkspaceId;
  fieldId: EntityId;
  boundary: RasterMultiPolygon;
  requestedAt: TimestampIso;
};

function createProbe(
  requestedAt: TimestampIso,
  probe: Omit<ImageryProviderFieldProbe, "requestedAt">,
): ImageryProviderFieldProbe {
  return {
    requestedAt,
    ...probe,
  };
}

function readStringMetadata(
  metadata: Readonly<Record<string, string | number | boolean | null>> | undefined,
  key: string,
) {
  const value = metadata?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readCachedQualityReuse(
  metadata: Readonly<Record<string, string | number | boolean | null>> | undefined,
) {
  return {
    cachedQualityReuseHit: metadata?.planetFieldQualityCacheHit === true,
    cachedQualityObservedAt: readStringMetadata(
      metadata,
      "planetFieldQualityCachedObservedAt",
    ),
    cachedQualitySourceKey: readStringMetadata(
      metadata,
      "planetFieldQualityCachedSourceKey",
    ),
  } as const;
}

async function probeClientForField(
  client: ImageryProviderClient,
  baseDiagnostics: ImageryProviderDiagnostics,
  input: ProbeImageryProvidersForFieldInput,
): Promise<ImageryProviderFieldDiagnostics> {
  try {
    const discovered = await client.discoverLatestScene({
      workspaceId: input.workspaceId,
      fieldId: input.fieldId,
      boundary: input.boundary,
      requestedAt: input.requestedAt,
    });

    if (!discovered) {
      return {
        ...baseDiagnostics,
        probe: createProbe(input.requestedAt, {
          status: "no-scene",
          sceneKey: null,
          capturedAt: null,
          discoveryMode: null,
          discoveryClient: null,
          reason: "No discoverable scene is currently available for this field.",
        }),
      };
    }

    const discoveryMode =
      typeof discovered.metadata?.discoveryMode === "string"
        ? discovered.metadata.discoveryMode
        : null;
    const discoveryClient =
      typeof discovered.metadata?.discoveryClient === "string"
        ? discovered.metadata.discoveryClient
        : null;
    const fallbackReason =
      typeof discovered.metadata?.discoveryFallbackReason === "string"
        ? discovered.metadata.discoveryFallbackReason
        : null;

    return {
      ...baseDiagnostics,
      probe: createProbe(input.requestedAt, {
        status: discoveryMode === "provider" ? "provider-scene" : "fallback-scene",
        sceneKey: discovered.scene.sceneKey,
        capturedAt: discovered.scene.capturedAt,
        discoveryMode,
        discoveryClient,
        reason: fallbackReason ?? discovered.note ?? null,
        ...readCachedQualityReuse(discovered.metadata),
      }),
    };
  } catch (error) {
    return {
      ...baseDiagnostics,
      probe: createProbe(input.requestedAt, {
        status: "error",
        sceneKey: null,
        capturedAt: null,
        discoveryMode: null,
        discoveryClient: null,
        reason:
          error instanceof Error
            ? error.message
            : "Field-scoped provider probe failed.",
      }),
    };
  }
}

export async function probeImageryProvidersForField(
  clients: readonly ImageryProviderClient[],
  input: ProbeImageryProvidersForFieldInput,
): Promise<readonly ImageryProviderFieldDiagnostics[]> {
  const diagnostics = await Promise.all(clients.map((client) => client.diagnose()));

  return Promise.all(
    clients.map((client, index) =>
      probeClientForField(client, diagnostics[index], input),
    ),
  );
}
