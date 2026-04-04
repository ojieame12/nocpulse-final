import {
  requireSupabaseData,
  type DatabaseClient,
  type DatabaseSchema,
} from "@fieldpulse/platform-db";
import type { FieldYieldAssumption } from "../contracts/FieldYieldAssumption";
import type { UpsertFieldYieldAssumptionInput } from "../contracts/UpsertFieldYieldAssumptionInput";
import type { FieldYieldAssumptionRepository } from "./FieldYieldAssumptionRepository";

type FieldYieldAssumptionRow =
  DatabaseSchema["app"]["Tables"]["field_yield_assumptions"]["Row"];

function mapAssumption(row: FieldYieldAssumptionRow): FieldYieldAssumption {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    fieldId: row.field_id,
    seasonYear: row.season_year,
    cropSymbol: row.crop_symbol,
    yieldTonnesPerHa: Number(row.yield_tonnes_per_ha),
    sourceKey: row.source_key,
    noteText: row.note_text,
    assumedAt: row.assumed_at,
    createdAt: row.created_at,
  };
}

export function createSupabaseFieldYieldAssumptionRepository(
  client: DatabaseClient,
): FieldYieldAssumptionRepository {
  return {
    async latest(workspaceId, fieldId, seasonYear, cropSymbol) {
      let query = client
        .from("field_yield_assumptions")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("field_id", fieldId);

      if (seasonYear != null) {
        query = query.eq("season_year", seasonYear);
      }

      if (cropSymbol && cropSymbol.trim().length > 0) {
        query = query.eq("crop_symbol", cropSymbol.trim().toUpperCase());
      } else {
        query = query.is("crop_symbol", null);
      }

      const result = await query
        .order("assumed_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (result.error) {
        throw result.error;
      }

      return result.data ? mapAssumption(result.data) : null;
    },
    async upsert(input) {
      const result = await client
        .from("field_yield_assumptions")
        .insert({
          workspace_id: input.workspaceId,
          field_id: input.fieldId,
          season_year: input.seasonYear ?? null,
          crop_symbol: input.cropSymbol?.trim().toUpperCase() ?? null,
          yield_tonnes_per_ha: input.yieldTonnesPerHa,
          source_key: input.sourceKey,
          note_text: input.noteText ?? null,
          assumed_at: input.assumedAt ?? new Date().toISOString(),
        })
        .select("*")
        .single();

      return mapAssumption(
        requireSupabaseData(result, "fieldYieldAssumptions.upsert"),
      );
    },
  };
}
