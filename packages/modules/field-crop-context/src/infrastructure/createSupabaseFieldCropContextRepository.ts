import {
  coerceNumber,
  requireSupabaseSuccess,
  requireSupabaseData,
  type DatabaseClient,
  type DatabaseSchema,
} from "@fieldpulse/platform-db";
import type { FieldCropContext } from "../contracts/FieldCropContext";
import type { UpsertFieldCropContextInput } from "../contracts/UpsertFieldCropContextInput";
import type { FieldCropContextRepository } from "./FieldCropContextRepository";

type FieldCropContextRow =
  DatabaseSchema["app"]["Tables"]["field_crop_contexts"]["Row"];

function mapFieldCropContext(row: FieldCropContextRow): FieldCropContext {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    fieldId: row.field_id,
    seasonYear: row.season_year,
    cropType: row.crop_type,
    growthStage: row.growth_stage,
    growthStageSource: row.growth_stage_source as FieldCropContext["growthStageSource"],
    accumulatedGdd: coerceNumber(row.accumulated_gdd),
    lastGddObservedOn: row.last_gdd_observed_on,
    lastWeatherSignalSetId: row.last_weather_signal_set_id,
    lastStageUpdatedAt: row.last_stage_updated_at,
    sourceKey: row.source_key,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createSupabaseFieldCropContextRepository(
  client: DatabaseClient,
): FieldCropContextRepository {
  return {
    async getLatestByField(workspaceId, fieldId) {
      const result = await client
        .from("field_crop_contexts")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("field_id", fieldId)
        .order("season_year", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (result.error) {
        throw result.error;
      }

      return result.data ? mapFieldCropContext(result.data) : null;
    },
    async deleteContext(workspaceId, fieldId, seasonYear) {
      const result = await client
        .from("field_crop_contexts")
        .delete()
        .eq("workspace_id", workspaceId)
        .eq("field_id", fieldId)
        .eq("season_year", seasonYear);

      requireSupabaseSuccess(result, "fieldCropContext.deleteContext");
    },
    async upsertContext(input: UpsertFieldCropContextInput) {
      const result = await client
        .from("field_crop_contexts")
        .upsert(
          {
            workspace_id: input.workspaceId,
            field_id: input.fieldId,
            season_year: input.seasonYear,
            crop_type: input.cropType,
            growth_stage: input.growthStage ?? null,
            growth_stage_source: input.growthStageSource ?? "imported",
            accumulated_gdd: input.accumulatedGdd ?? 0,
            last_gdd_observed_on: input.lastGddObservedOn ?? null,
            last_weather_signal_set_id: input.lastWeatherSignalSetId ?? null,
            last_stage_updated_at: input.lastStageUpdatedAt ?? null,
            source_key: input.sourceKey,
            metadata: input.metadata ?? {},
          },
          {
            onConflict: "workspace_id,field_id,season_year",
          },
        )
        .select("*")
        .single();

      return mapFieldCropContext(
        requireSupabaseData(result, "fieldCropContext.upsertContext"),
      );
    },
  };
}
