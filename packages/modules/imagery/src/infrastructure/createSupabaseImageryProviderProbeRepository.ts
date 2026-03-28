import {
  requireSupabaseData,
  type DatabaseClient,
  type DatabaseSchema,
  type JsonValue,
} from "@fieldpulse/platform-db";
import type { ImageryProviderProbeRepository } from "../contracts/ImageryProviderProbeRepository";
import type {
  CreateImageryProviderProbeRecordInput,
  ImageryProviderProbeRecord,
} from "../contracts/ImageryProviderProbeRecord";

type ImageryProviderProbeRunRow =
  DatabaseSchema["app"]["Tables"]["imagery_provider_probe_runs"]["Row"];

function isRecord(value: JsonValue): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toDetails(value: JsonValue) {
  if (!isRecord(value)) {
    return {};
  }

  const details: Record<string, string | number | boolean | null> = {};

  for (const [key, entryValue] of Object.entries(value)) {
    if (
      typeof entryValue === "string" ||
      typeof entryValue === "number" ||
      typeof entryValue === "boolean" ||
      entryValue === null
    ) {
      details[key] = entryValue;
    }
  }

  return Object.freeze(details);
}

function mapProbeRecord(row: ImageryProviderProbeRunRow): ImageryProviderProbeRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    fieldId: row.field_id,
    provider: row.provider_key as ImageryProviderProbeRecord["provider"],
    requestedAt: row.requested_at,
    providerStatus:
      row.provider_status as ImageryProviderProbeRecord["providerStatus"],
    discoveryMode: row.discovery_mode,
    materializationMode: row.materialization_mode,
    discoveryClient: row.discovery_client,
    materializationClient: row.materialization_client,
    fallbackClient: row.fallback_client,
    reason: row.reason,
    probeStatus: row.probe_status as ImageryProviderProbeRecord["probeStatus"],
    probeSceneKey: row.probe_scene_key,
    probeCapturedAt: row.probe_captured_at,
    probeDiscoveryMode: row.probe_discovery_mode,
    probeDiscoveryClient: row.probe_discovery_client,
    probeReason: row.probe_reason,
    details: toDetails(row.details),
    createdAt: row.created_at,
    updatedAt: row.created_at,
  };
}

function toInsertRow(input: CreateImageryProviderProbeRecordInput) {
  return {
    workspace_id: input.workspaceId,
    field_id: input.fieldId,
    provider_key: input.provider,
    requested_at: input.requestedAt,
    provider_status: input.providerStatus,
    discovery_mode: input.discoveryMode,
    materialization_mode: input.materializationMode,
    discovery_client: input.discoveryClient ?? null,
    materialization_client: input.materializationClient ?? null,
    fallback_client: input.fallbackClient ?? null,
    reason: input.reason ?? null,
    probe_status: input.probeStatus,
    probe_scene_key: input.probeSceneKey ?? null,
    probe_captured_at: input.probeCapturedAt ?? null,
    probe_discovery_mode: input.probeDiscoveryMode ?? null,
    probe_discovery_client: input.probeDiscoveryClient ?? null,
    probe_reason: input.probeReason ?? null,
    details: input.details ?? {},
  };
}

export function createSupabaseImageryProviderProbeRepository(
  client: DatabaseClient,
): ImageryProviderProbeRepository {
  return {
    async createMany(inputs) {
      if (inputs.length === 0) {
        return [];
      }

      const result = await client
        .from("imagery_provider_probe_runs")
        .insert(inputs.map(toInsertRow))
        .select("*")
        .order("created_at", { ascending: false });

      return requireSupabaseData(
        result,
        "imageryProviderProbes.createMany",
      ).map(mapProbeRecord);
    },

    async listLatestByField(input) {
      const result = await client
        .from("imagery_provider_probe_runs")
        .select("*")
        .eq("workspace_id", input.workspaceId)
        .eq("field_id", input.fieldId)
        .order("created_at", { ascending: false })
        .limit(input.limit ?? 20);

      return requireSupabaseData(
        result,
        "imageryProviderProbes.listLatestByField",
      ).map(mapProbeRecord);
    },

    async listRecent(input = {}) {
      let query = client
        .from("imagery_provider_probe_runs")
        .select("*")
        .order("created_at", { ascending: false });

      if (input.createdAfter) {
        query = query.gte("created_at", input.createdAfter);
      }

      const result = await query.limit(input.limit ?? 100);

      return requireSupabaseData(
        result,
        "imageryProviderProbes.listRecent",
      ).map(mapProbeRecord);
    },
  };
}
