import type { EntityId, TimestampIso, WorkspaceId } from "@fieldpulse/platform-db";
import type { ImageryProviderFieldDiagnostics } from "../contracts/ImageryProviderDiagnostics";
import type { ImageryProviderProbeRecord } from "../contracts/ImageryProviderProbeRecord";
import type { ImageryProviderProbeRepository } from "../contracts/ImageryProviderProbeRepository";
import type { ImageryProviderClient } from "../contracts/ImageryProviderClient";
import {
  probeImageryProvidersForField,
  type ProbeImageryProvidersForFieldInput,
} from "./probeImageryProvidersForField";

export type RecordImageryProviderProbeForFieldInput = ProbeImageryProvidersForFieldInput;

function toProbeCreateInput(
  workspaceId: WorkspaceId,
  fieldId: EntityId,
  diagnostic: ImageryProviderFieldDiagnostics,
  requestedAt: TimestampIso,
) {
  const details = {
    ...diagnostic.details,
    ...(diagnostic.probe.cachedQualityReuseHit
      ? { probeCachedQualityReuseHit: true }
      : {}),
    ...(diagnostic.probe.cachedQualityObservedAt
      ? {
          probeCachedQualityObservedAt: diagnostic.probe.cachedQualityObservedAt,
        }
      : {}),
    ...(diagnostic.probe.cachedQualitySourceKey
      ? {
          probeCachedQualitySourceKey: diagnostic.probe.cachedQualitySourceKey,
        }
      : {}),
  } as const;

  return {
    workspaceId,
    fieldId,
    provider: diagnostic.provider,
    requestedAt,
    providerStatus: diagnostic.status,
    discoveryMode: diagnostic.discoveryMode,
    materializationMode: diagnostic.materializationMode,
    discoveryClient: diagnostic.discoveryClient,
    materializationClient: diagnostic.materializationClient,
    fallbackClient: diagnostic.fallbackClient,
    reason: diagnostic.reason,
    probeStatus: diagnostic.probe.status,
    probeSceneKey: diagnostic.probe.sceneKey,
    probeCapturedAt: diagnostic.probe.capturedAt,
    probeDiscoveryMode: diagnostic.probe.discoveryMode,
    probeDiscoveryClient: diagnostic.probe.discoveryClient,
    probeReason: diagnostic.probe.reason,
    details,
  } as const;
}

export async function recordImageryProviderProbeForField(
  repository: ImageryProviderProbeRepository,
  clients: readonly ImageryProviderClient[],
  input: RecordImageryProviderProbeForFieldInput,
): Promise<{
  diagnostics: readonly ImageryProviderFieldDiagnostics[];
  records: readonly ImageryProviderProbeRecord[];
}> {
  const diagnostics = await probeImageryProvidersForField(clients, input);
  const records = await repository.createMany(
    diagnostics.map((diagnostic) =>
      toProbeCreateInput(
        input.workspaceId,
        input.fieldId,
        diagnostic,
        input.requestedAt,
      ),
    ),
  );

  return {
    diagnostics,
    records,
  };
}
