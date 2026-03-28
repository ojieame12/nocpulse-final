import {
  coerceNumber,
  requireSupabaseData,
  type DatabaseClient,
  type DatabaseSchema,
  type JsonValue,
} from "@fieldpulse/platform-db";
import type { FieldHailEvent } from "../contracts/FieldHailEvent";
import type { HailProvider } from "../contracts/HailProvider";
import type { UpsertFieldHailEventInput } from "../contracts/UpsertFieldHailEventInput";
import type { FieldHailEventRepository } from "./FieldHailEventRepository";

type FieldHailEventRow = DatabaseSchema["app"]["Tables"]["field_hail_events"]["Row"];

function mapFieldHailEvent(row: FieldHailEventRow): FieldHailEvent {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    fieldId: row.field_id,
    providerKey: row.provider_key as HailProvider,
    sourceKey: row.source_key,
    sourceEventKey: row.source_event_key,
    dedupeKey: row.dedupe_key,
    eventType: row.event_type,
    severity: row.severity,
    reportedAt: row.reported_at,
    windowStart: row.window_start,
    windowEnd: row.window_end,
    headline: row.headline,
    summary: row.summary,
    hailSizeMm: row.hail_size_mm == null ? null : coerceNumber(row.hail_size_mm),
    coverageGeoJson: row.coverage_geojson,
    provenance: row.provenance,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createSupabaseFieldHailEventRepository(
  client: DatabaseClient,
): FieldHailEventRepository {
  return {
    async upsertEvent(input) {
      const result = await client
        .from("field_hail_events")
        .upsert(
          {
            workspace_id: input.workspaceId,
            field_id: input.fieldId,
            provider_key: input.providerKey,
            source_key: input.sourceKey,
            source_event_key: input.sourceEventKey,
            dedupe_key: input.dedupeKey,
            event_type: input.eventType,
            severity: input.severity,
            reported_at: input.reportedAt,
            window_start: input.windowStart ?? null,
            window_end: input.windowEnd ?? null,
            headline: input.headline,
            summary: input.summary ?? null,
            hail_size_mm: input.hailSizeMm ?? null,
            coverage_geojson: (input.coverageGeoJson ?? null) as JsonValue | null,
            provenance: input.provenance ?? {},
          },
          {
            onConflict: "field_id,dedupe_key",
          },
        )
        .select("*")
        .single();

      return mapFieldHailEvent(requireSupabaseData(result, "hail.upsertEvent"));
    },

    async listByField(workspaceId, fieldId, limit = 25, reportedAfter) {
      let query = client
        .from("field_hail_events")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("field_id", fieldId)
        .order("reported_at", { ascending: false })
        .order("updated_at", { ascending: false });

      if (reportedAfter) {
        query = query.gte("reported_at", reportedAfter);
      }

      const result = await query.limit(limit);

      return requireSupabaseData(result, "hail.listByField").map(mapFieldHailEvent);
    },

    async listRecentByWorkspace(workspaceId, limit = 100, reportedAfter) {
      let query = client
        .from("field_hail_events")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("reported_at", { ascending: false })
        .order("updated_at", { ascending: false });

      if (reportedAfter) {
        query = query.gte("reported_at", reportedAfter);
      }

      const result = await query.limit(limit);

      return requireSupabaseData(
        result,
        "hail.listRecentByWorkspace",
      ).map(mapFieldHailEvent);
    },
  };
}
