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

function readString(
  value: Record<string, JsonValue>,
  key: string,
): string | undefined {
  return typeof value[key] === "string" ? (value[key] as string) : undefined;
}

function readBoolean(
  value: Record<string, JsonValue>,
  key: string,
): boolean | undefined {
  return typeof value[key] === "boolean" ? (value[key] as boolean) : undefined;
}

function readNumber(
  value: Record<string, JsonValue>,
  key: string,
): number | undefined {
  return typeof value[key] === "number" && Number.isFinite(value[key])
    ? (value[key] as number)
    : undefined;
}

function toMoistureInputProvenance(value: JsonValue): MoistureInputProvenance {
  if (!isRecord(value)) {
    return {};
  }

  return {
    forecastModel: readString(value, "forecastModel"),
    radarDataset: readString(value, "radarDataset"),
    sarDataset: readString(value, "sarDataset"),
    soilDataset: readString(value, "soilDataset"),
    baselineDataset: readString(value, "baselineDataset"),
    rasterSourceKey: readString(value, "rasterSourceKey"),
    weatherSourceKey: readString(value, "weatherSourceKey"),
    moistureModelVersion: readString(value, "moistureModelVersion"),
    derivationMode:
      value.derivationMode === "source-backed" || value.derivationMode === "seeded-range"
        ? value.derivationMode
        : undefined,
    rasterMode:
      value.rasterMode === "provider" ||
      value.rasterMode === "synthetic" ||
      value.rasterMode === "none"
        ? value.rasterMode
        : undefined,
    signalBlend:
      value.signalBlend === "raster+weather" ||
      value.signalBlend === "raster-only" ||
      value.signalBlend === "weather-only" ||
      value.signalBlend === "seeded"
        ? value.signalBlend
        : undefined,
    usedOptical: readBoolean(value, "usedOptical"),
    usedSar: readBoolean(value, "usedSar"),
    usedWeather: readBoolean(value, "usedWeather"),
    usedWeatherSoilMoisture: readBoolean(value, "usedWeatherSoilMoisture"),
    confidenceScore: readNumber(value, "confidenceScore"),
    confidenceReason: readString(value, "confidenceReason"),
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
