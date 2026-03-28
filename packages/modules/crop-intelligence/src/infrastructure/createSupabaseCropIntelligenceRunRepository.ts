import { requireSupabaseData, type DatabaseClient, type DatabaseSchema } from "@fieldpulse/platform-db";
import type { CropIntelligenceRun } from "../contracts/CropIntelligenceRun";
import type { CropIntelligenceRunStatus } from "../contracts/IntelligenceFindingFamily";
import type { UpsertCropIntelligenceRunInput } from "../contracts/UpsertCropIntelligenceRunInput";
import type { CropIntelligenceRunRepository } from "./CropIntelligenceRunRepository";

type CropIntelligenceRunRow =
  DatabaseSchema["app"]["Tables"]["field_intelligence_runs"]["Row"];

function mapCropIntelligenceRun(row: CropIntelligenceRunRow): CropIntelligenceRun {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    fieldId: row.field_id,
    sourceKey: row.source_key,
    modelKey: row.model_key,
    status: row.status as CropIntelligenceRunStatus,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    inputVersion: row.input_version,
    provenance: row.provenance,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createSupabaseCropIntelligenceRunRepository(
  client: DatabaseClient,
): CropIntelligenceRunRepository {
  return {
    async listLatestByWorkspace(workspaceId, sourceKey) {
      let query = client
        .from("field_intelligence_runs")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("started_at", { ascending: false })
        .order("updated_at", { ascending: false });

      if (sourceKey) {
        query = query.eq("source_key", sourceKey);
      }

      const result = await query;
      const runs = requireSupabaseData(
        result,
        "cropIntelligence.listLatestRunsByWorkspace",
      ).map(mapCropIntelligenceRun);
      const latestByField = new Map<string, CropIntelligenceRun>();

      for (const run of runs) {
        if (!latestByField.has(run.fieldId)) {
          latestByField.set(run.fieldId, run);
        }
      }

      return Array.from(latestByField.values());
    },
    async listRecentRuns(input) {
      let query = client
        .from("field_intelligence_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .order("updated_at", { ascending: false });

      if (input.workspaceId) {
        query = query.eq("workspace_id", input.workspaceId);
      }

      if (input.startedAfter) {
        query = query.gte("started_at", input.startedAfter);
      }

      if (input.sourceKey) {
        query = query.eq("source_key", input.sourceKey);
      }

      if (input.status) {
        query = query.eq("status", input.status);
      }

      if (input.limit != null) {
        query = query.limit(input.limit);
      }

      const result = await query;

      return requireSupabaseData(
        result,
        "cropIntelligence.listRecentRuns",
      ).map(mapCropIntelligenceRun);
    },
    async upsertRun(input) {
      const result = await client
        .from("field_intelligence_runs")
        .upsert(
          {
            workspace_id: input.workspaceId,
            field_id: input.fieldId,
            source_key: input.sourceKey,
            model_key: input.modelKey,
            status: input.status,
            started_at: input.startedAt,
            completed_at: input.completedAt ?? null,
            input_version: input.inputVersion ?? null,
            provenance: input.provenance ?? {},
          },
          {
            onConflict: "field_id,source_key,started_at",
          },
        )
        .select("*")
        .single();

      return mapCropIntelligenceRun(
        requireSupabaseData(result, "cropIntelligence.upsertRun"),
      );
    },
  };
}
