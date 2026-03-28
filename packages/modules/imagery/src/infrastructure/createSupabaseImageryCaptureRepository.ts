import {
  coerceNumber,
  requireSupabaseData,
  type DatabaseClient,
  type DatabaseSchema,
  type EntityId,
  type JsonValue,
  type WorkspaceId,
} from "@fieldpulse/platform-db";
import type {
  ImageryCapture,
  ImageryCaptureMetadata,
  UpsertImageryCaptureInput,
} from "../contracts/ImageryCapture";
import type { ImageryCaptureRepository } from "./ImageryCaptureRepository";

type FieldImageryCaptureRow =
  DatabaseSchema["app"]["Tables"]["field_imagery_captures"]["Row"];

function isRecord(value: JsonValue): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toMetadata(value: JsonValue): ImageryCaptureMetadata {
  if (!isRecord(value)) {
    return {};
  }

  const metadata: Record<string, string | number | boolean | null> = {};

  for (const [key, entryValue] of Object.entries(value)) {
    if (
      typeof entryValue === "string" ||
      typeof entryValue === "number" ||
      typeof entryValue === "boolean" ||
      entryValue === null
    ) {
      metadata[key] = entryValue;
    }
  }

  return Object.freeze(metadata);
}

function mapCapture(row: FieldImageryCaptureRow): ImageryCapture {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    fieldId: row.field_id,
    requestedAt: row.requested_at,
    capturedAt: row.captured_at,
    providerKey: row.provider_key as ImageryCapture["providerKey"],
    sceneKey: row.scene_key,
    status: row.status as ImageryCapture["status"],
    coveragePct: coerceNumber(row.coverage_pct),
    cloudCoverPct:
      row.cloud_cover_pct === null ? null : coerceNumber(row.cloud_cover_pct),
    note: row.note,
    metadata: toMetadata(row.metadata),
    observationId: row.observation_id,
    createdAt: row.created_at,
  };
}

export function createSupabaseImageryCaptureRepository(
  client: DatabaseClient,
): ImageryCaptureRepository {
  return {
    async getLatestByField(workspaceId: WorkspaceId, fieldId: EntityId) {
      const result = await client
        .from("field_imagery_captures")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("field_id", fieldId)
        .order("requested_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (result.error) {
        throw result.error;
      }

      return result.data ? mapCapture(result.data) : null;
    },

    async listRecent(input = {}) {
      let query = client
        .from("field_imagery_captures")
        .select("*")
        .order("created_at", { ascending: false });

      if (input.workspaceId) {
        query = query.eq("workspace_id", input.workspaceId);
      }

      if (input.createdAfter) {
        query = query.gte("created_at", input.createdAfter);
      }

      const result = await query.limit(input.limit ?? 100);

      return requireSupabaseData(
        result,
        "imageryCaptures.listRecent",
      ).map(mapCapture);
    },

    async upsertCapture(input: UpsertImageryCaptureInput) {
      const result = await client
        .from("field_imagery_captures")
        .upsert(
          {
            workspace_id: input.workspaceId,
            field_id: input.fieldId,
            requested_at: input.requestedAt,
            captured_at: input.capturedAt,
            provider_key: input.providerKey,
            scene_key: input.sceneKey,
            status: input.status,
            coverage_pct: input.coveragePct,
            cloud_cover_pct: input.cloudCoverPct ?? null,
            note: input.note ?? null,
            metadata: input.metadata ?? {},
            observation_id: input.observationId ?? null,
          },
          {
            onConflict: "workspace_id,field_id,provider_key,scene_key",
          },
        )
        .select("*")
        .single();

      return mapCapture(
        requireSupabaseData(result, "imageryCaptures.upsertCapture"),
      );
    },
  };
}
