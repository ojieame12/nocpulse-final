import {
  requireSupabaseData,
  type DatabaseClient,
  type DatabaseSchema,
} from "@fieldpulse/platform-db";
import type { FieldIntelligenceZone } from "../contracts/FieldIntelligenceZone";
import type {
  IntelligenceFindingFamily,
  IntelligenceSeverity,
  IntelligenceZoneStatus,
} from "../contracts/IntelligenceFindingFamily";
import type { UpsertFieldIntelligenceZoneInput } from "../contracts/UpsertFieldIntelligenceZoneInput";
import type { FieldIntelligenceZoneRepository } from "./FieldIntelligenceZoneRepository";

type FieldIntelligenceZoneRow =
  DatabaseSchema["app"]["Tables"]["field_intelligence_zones"]["Row"];

function mapZone(row: FieldIntelligenceZoneRow): FieldIntelligenceZone {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    fieldId: row.field_id,
    family: row.family as IntelligenceFindingFamily,
    trackingKey: row.tracking_key,
    latestFindingId: row.latest_finding_id,
    latestRunId: row.latest_run_id,
    status: row.status as IntelligenceZoneStatus,
    latestSeverity: row.latest_severity as IntelligenceSeverity | null,
    zoneGeoJson: row.zone_geojson,
    affectedCellKeys: row.affected_cell_keys ?? [],
    detectionCount: row.detection_count,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    lastStatusChangedAt: row.last_status_changed_at,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createSupabaseFieldIntelligenceZoneRepository(
  client: DatabaseClient,
): FieldIntelligenceZoneRepository {
  return {
    async listByField(input) {
      let query = client
        .from("field_intelligence_zones")
        .select("*")
        .eq("workspace_id", input.workspaceId)
        .eq("field_id", input.fieldId)
        .order("last_seen_at", { ascending: false })
        .order("updated_at", { ascending: false });

      if (input.family) {
        query = query.eq("family", input.family);
      }

      if (input.trackingKey) {
        query = query.eq("tracking_key", input.trackingKey);
      }

      if (input.status) {
        query = query.eq("status", input.status);
      }

      const result = await query.limit(input.limit ?? 100);

      return requireSupabaseData(
        result,
        "cropIntelligence.listZonesByField",
      ).map(mapZone);
    },

    async listByTrackingKey(input) {
      const result = await client
        .from("field_intelligence_zones")
        .select("*")
        .eq("workspace_id", input.workspaceId)
        .eq("field_id", input.fieldId)
        .eq("family", input.family)
        .eq("tracking_key", input.trackingKey)
        .order("last_seen_at", { ascending: false })
        .order("updated_at", { ascending: false });

      return requireSupabaseData(
        result,
        "cropIntelligence.listZonesByTrackingKey",
      ).map(mapZone);
    },

    async upsertZone(input) {
      const result = await client
        .from("field_intelligence_zones")
        .upsert(
          {
            id: input.id,
            workspace_id: input.workspaceId,
            field_id: input.fieldId,
            family: input.family,
            tracking_key: input.trackingKey,
            latest_finding_id: input.latestFindingId ?? null,
            latest_run_id: input.latestRunId ?? null,
            status: input.status,
            latest_severity: input.latestSeverity ?? null,
            zone_geojson: input.zoneGeoJson,
            affected_cell_keys: [...input.affectedCellKeys],
            detection_count: input.detectionCount,
            first_seen_at: input.firstSeenAt,
            last_seen_at: input.lastSeenAt,
            last_status_changed_at: input.lastStatusChangedAt,
            metadata: input.metadata ?? {},
          },
          {
            onConflict: "id",
          },
        )
        .select("*")
        .single();

      return mapZone(requireSupabaseData(result, "cropIntelligence.upsertZone"));
    },
  };
}
