import {
  coerceNumber,
  requireSupabaseData,
  type DatabaseClient,
  type DatabaseSchema,
  type JsonValue,
  type WorkspaceId,
} from "@fieldpulse/platform-db";
import type {
  FieldMoistureSnapshot,
  MoistureInputProvenance,
} from "../contracts/FieldMoistureSnapshot";
import type { MoistureEstimate } from "../contracts/MoistureEstimate";
import type { UpsertFieldMoistureSnapshotInput } from "../contracts/UpsertFieldMoistureSnapshotInput";
import type { FieldMoistureSnapshotRepository } from "./FieldMoistureSnapshotRepository";
import type { MoistureEstimateStore } from "./MoistureEstimateStore";

type FieldMoistureSnapshotRow =
  DatabaseSchema["app"]["Tables"]["field_moisture_snapshots"]["Row"];

function isRecord(value: JsonValue): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toMoistureInputProvenance(value: JsonValue): MoistureInputProvenance {
  if (!isRecord(value)) {
    return {};
  }

  return {
    forecastModel:
      typeof value.forecastModel === "string" ? value.forecastModel : undefined,
    radarDataset:
      typeof value.radarDataset === "string" ? value.radarDataset : undefined,
    sarDataset:
      typeof value.sarDataset === "string" ? value.sarDataset : undefined,
    soilDataset:
      typeof value.soilDataset === "string" ? value.soilDataset : undefined,
  };
}

function mapFieldMoistureSnapshot(
  row: FieldMoistureSnapshotRow,
): FieldMoistureSnapshot {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    fieldId: row.field_id,
    observedAt: row.observed_at,
    sourceKey: row.source_key,
    rootZonePct: coerceNumber(row.root_zone_pct),
    surfacePct: coerceNumber(row.surface_pct),
    confidence: row.confidence,
    inputs: toMoistureInputProvenance(row.inputs),
    createdAt: row.created_at,
  };
}

function toMoistureEstimate(snapshot: FieldMoistureSnapshot): MoistureEstimate {
  return {
    rootZonePct: snapshot.rootZonePct,
    surfacePct: snapshot.surfacePct,
    confidence: snapshot.confidence,
  };
}

export function createSupabaseFieldMoistureSnapshotRepository(
  client: DatabaseClient,
): FieldMoistureSnapshotRepository {
  return {
    async getLatestByField(workspaceId, fieldId) {
      const result = await client
        .from("field_moisture_snapshots")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("field_id", fieldId)
        .order("observed_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (result.error) {
        throw result.error;
      }

      return result.data ? mapFieldMoistureSnapshot(result.data) : null;
    },

    async upsertSnapshot(input: UpsertFieldMoistureSnapshotInput) {
      const result = await client
        .from("field_moisture_snapshots")
        .upsert(
          {
            workspace_id: input.workspaceId,
            field_id: input.fieldId,
            observed_at: input.observedAt,
            source_key: input.sourceKey,
            root_zone_pct: input.rootZonePct,
            surface_pct: input.surfacePct,
            confidence: input.confidence,
            inputs: input.inputs,
          },
          {
            onConflict: "field_id,observed_at,source_key",
          },
        )
        .select("*")
        .single();

      return mapFieldMoistureSnapshot(
        requireSupabaseData(result, "moisture.upsertSnapshot"),
      );
    },
  };
}

export function createSupabaseMoistureEstimateStore(
  client: DatabaseClient,
): MoistureEstimateStore {
  const snapshots = createSupabaseFieldMoistureSnapshotRepository(client);

  return {
    async getFieldEstimate(workspaceId: WorkspaceId, fieldId) {
      const snapshot = await snapshots.getLatestByField(workspaceId, fieldId);
      return snapshot ? toMoistureEstimate(snapshot) : null;
    },
  };
}
