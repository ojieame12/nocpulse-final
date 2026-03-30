import {
  requireSupabaseData,
  type DatabaseClient,
  type DatabaseSchema,
} from "@fieldpulse/platform-db";
import type { GrainPriceSnapshot } from "../contracts/GrainPriceSnapshot";
import type { UpsertGrainPriceSnapshotInput } from "../contracts/UpsertGrainPriceSnapshotInput";
import type { GrainPriceSnapshotRepository } from "./GrainPriceSnapshotRepository";

type GrainPriceSnapshotRow =
  DatabaseSchema["app"]["Tables"]["grain_price_snapshots"]["Row"];

function mapSnapshot(row: GrainPriceSnapshotRow): GrainPriceSnapshot {
  return {
    id: row.id,
    cropSymbol: row.crop_symbol,
    closePriceCadPerTonne: Number(row.close_price_cad_per_tonne),
    basisCadPerTonne: Number(row.basis_cad_per_tonne),
    sourceCurrency: row.source_currency,
    sourceUnit: row.source_unit,
    sourceClosePrice: Number(row.source_close_price),
    fxRateToCad: Number(row.fx_rate_to_cad),
    sourceKey: row.source_key,
    capturedAt: row.captured_at,
    createdAt: row.created_at,
  };
}

export function createSupabaseGrainPriceSnapshotRepository(
  client: DatabaseClient,
): GrainPriceSnapshotRepository {
  return {
    async latest(cropSymbol) {
      const result = await client
        .from("grain_price_snapshots")
        .select("*")
        .eq("crop_symbol", cropSymbol.toUpperCase())
        .order("captured_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (result.error) {
        throw result.error;
      }

      return result.data ? mapSnapshot(result.data) : null;
    },
    async recent(cropSymbol, limit) {
      const safeLimit = Math.max(1, Math.min(24, Math.trunc(limit)));
      const result = await client
        .from("grain_price_snapshots")
        .select("*")
        .eq("crop_symbol", cropSymbol.toUpperCase())
        .order("captured_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(safeLimit);

      if (result.error) {
        throw result.error;
      }

      return (result.data ?? []).map(mapSnapshot);
    },
    async upsert(input: UpsertGrainPriceSnapshotInput) {
      const result = await client
        .from("grain_price_snapshots")
        .insert({
          crop_symbol: input.cropSymbol.toUpperCase(),
          close_price_cad_per_tonne: input.closePriceCadPerTonne,
          basis_cad_per_tonne: input.basisCadPerTonne ?? 0,
          source_currency: input.sourceCurrency ?? "CAD",
          source_unit: input.sourceUnit ?? "tonne",
          source_close_price:
            input.sourceClosePrice ?? input.closePriceCadPerTonne,
          fx_rate_to_cad: input.fxRateToCad ?? 1,
          source_key: input.sourceKey,
          captured_at: input.capturedAt ?? new Date().toISOString(),
        })
        .select("*")
        .single();

      return mapSnapshot(
        requireSupabaseData(result, "grainPriceSnapshots.upsert"),
      );
    },
  };
}
