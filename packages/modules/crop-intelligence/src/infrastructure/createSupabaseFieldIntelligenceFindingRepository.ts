import { coerceNumber, requireSupabaseData, type DatabaseClient, type DatabaseSchema, type JsonValue } from "@fieldpulse/platform-db";
import type { FieldIntelligenceEvidence } from "../contracts/FieldIntelligenceEvidence";
import type { FieldIntelligenceFinding } from "../contracts/FieldIntelligenceFinding";
import type {
  IntelligenceFindingFamily,
  IntelligenceFindingStatus,
  IntelligenceSeverity,
} from "../contracts/IntelligenceFindingFamily";
import type { UpsertFieldIntelligenceFindingInput } from "../contracts/UpsertFieldIntelligenceFindingInput";
import type { FieldIntelligenceFindingRepository } from "./FieldIntelligenceFindingRepository";

type FieldIntelligenceFindingRow =
  DatabaseSchema["app"]["Tables"]["field_intelligence_findings"]["Row"];

function toEvidence(value: JsonValue): FieldIntelligenceEvidence {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const record = value as Record<string, unknown>;

  return {
    captureId:
      typeof record.captureId === "string" ? record.captureId : undefined,
    rasterObservationId:
      typeof record.rasterObservationId === "string"
        ? record.rasterObservationId
        : undefined,
    moistureSnapshotId:
      typeof record.moistureSnapshotId === "string"
        ? record.moistureSnapshotId
        : undefined,
    weatherObservationId:
      typeof record.weatherObservationId === "string"
        ? record.weatherObservationId
        : undefined,
    weatherSignalSetId:
      typeof record.weatherSignalSetId === "string"
        ? record.weatherSignalSetId
        : undefined,
    hailEventId:
      typeof record.hailEventId === "string" ? record.hailEventId : undefined,
    affectedCellKeys: Array.isArray(record.affectedCellKeys)
      ? record.affectedCellKeys.filter(
          (item): item is string => typeof item === "string",
        )
      : undefined,
    datasetVersion:
      typeof record.datasetVersion === "string"
        ? record.datasetVersion
        : undefined,
    providerKeys: Array.isArray(record.providerKeys)
      ? record.providerKeys.filter(
          (item): item is string => typeof item === "string",
        )
      : undefined,
    metadata:
      record.metadata !== undefined
        ? (record.metadata as FieldIntelligenceEvidence["metadata"])
        : undefined,
  };
}

function mapFinding(row: FieldIntelligenceFindingRow): FieldIntelligenceFinding {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    fieldId: row.field_id,
    runId: row.run_id,
    family: row.family as IntelligenceFindingFamily,
    severity: row.severity as IntelligenceSeverity,
    status: row.status as IntelligenceFindingStatus,
    sourceKey: row.source_key,
    dedupeKey: row.dedupe_key,
    title: row.title,
    summary: row.summary,
    explanation: row.explanation,
    recommendedAction: row.recommended_action,
    confidence: row.confidence == null ? null : coerceNumber(row.confidence),
    zoneGeoJson: row.zone_geojson,
    affectedCellKeys: row.affected_cell_keys ?? [],
    evidence: toEvidence(row.evidence),
    startedAt: row.started_at,
    endedAt: row.ended_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createSupabaseFieldIntelligenceFindingRepository(
  client: DatabaseClient,
): FieldIntelligenceFindingRepository {
  return {
    async getById(workspaceId, findingId) {
      const result = await client
        .from("field_intelligence_findings")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("id", findingId)
        .maybeSingle();

      if (result.error) {
        throw result.error;
      }

      return result.data ? mapFinding(result.data) : null;
    },

    async getByDedupeKey(workspaceId, fieldId, dedupeKey) {
      const result = await client
        .from("field_intelligence_findings")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("field_id", fieldId)
        .eq("dedupe_key", dedupeKey)
        .maybeSingle();

      if (result.error) {
        throw result.error;
      }

      return result.data ? mapFinding(result.data) : null;
    },

    async listByField(workspaceId, fieldId, limit = 50, status) {
      let query = client
        .from("field_intelligence_findings")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("field_id", fieldId)
        .order("started_at", { ascending: false })
        .order("updated_at", { ascending: false });

      if (status) {
        query = query.eq("status", status);
      }

      const result = await query.limit(limit);

      return requireSupabaseData(
        result,
        "cropIntelligence.listByField",
      ).map(mapFinding);
    },

    async listRecentByWorkspace(input) {
      let query = client
        .from("field_intelligence_findings")
        .select("*")
        .eq("workspace_id", input.workspaceId)
        .order("started_at", { ascending: false })
        .order("updated_at", { ascending: false });

      if (input.status) {
        query = query.eq("status", input.status);
      }

      if (input.family) {
        query = query.eq("family", input.family);
      }

      if (input.updatedAfter) {
        query = query.gte("updated_at", input.updatedAfter);
      }

      const result = await query.limit(input.limit ?? 100);

      return requireSupabaseData(
        result,
        "cropIntelligence.listRecentByWorkspace",
      ).map(mapFinding);
    },

    async upsertFinding(input) {
      const result = await client
        .from("field_intelligence_findings")
        .upsert(
          {
            workspace_id: input.workspaceId,
            field_id: input.fieldId,
            run_id: input.runId ?? null,
            family: input.family,
            severity: input.severity,
            status: input.status ?? "active",
            source_key: input.sourceKey,
            dedupe_key: input.dedupeKey,
            title: input.title,
            summary: input.summary ?? null,
            explanation: input.explanation ?? null,
            recommended_action: input.recommendedAction ?? null,
            confidence: input.confidence ?? null,
            zone_geojson: input.zoneGeoJson ?? null,
            affected_cell_keys: [...(input.affectedCellKeys ?? [])],
            evidence: input.evidence ?? {},
            started_at: input.startedAt,
            ended_at: input.endedAt ?? null,
          },
          {
            onConflict: "field_id,dedupe_key",
          },
        )
        .select("*")
        .single();

      return mapFinding(
        requireSupabaseData(result, "cropIntelligence.upsertFinding"),
      );
    },
  };
}
