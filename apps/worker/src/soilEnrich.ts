import type { SoilPropertiesProvider } from "@fieldpulse/module-soil";
import type { DatabaseClient } from "@fieldpulse/platform-db";

/* ------------------------------------------------------------------ */
/* Public types                                                       */
/* ------------------------------------------------------------------ */

export type SoilEnrichInput = {
  fieldId: string;
  centroidLat: number;
  centroidLng: number;
};

export type SoilEnrichResult = {
  fieldId: string;
  action: "enriched" | "skipped" | "failed";
  reason?: string;
};

export type SoilEnrichDeps = {
  db: DatabaseClient;
  soilProvider: SoilPropertiesProvider;
  logger?: {
    info(message: string): void;
    warn(message: string): void;
  };
};

/* ------------------------------------------------------------------ */
/* Core enrichment function                                           */
/* ------------------------------------------------------------------ */

/**
 * Fetch soil properties (FC & WP) for a single field and persist them
 * into `field_soil_properties`. Idempotent: skips fields that already
 * have `soil_properties_fetched_at` set.
 */
export async function enrichFieldSoilProperties(
  input: SoilEnrichInput,
  deps: SoilEnrichDeps,
): Promise<SoilEnrichResult> {
  const { fieldId, centroidLat, centroidLng } = input;
  const { db, soilProvider, logger } = deps;

  // ---- Idempotency check ----
  const { data: existing } = await db
    .from("field_soil_properties")
    .select("soil_properties_fetched_at")
    .eq("field_id", fieldId)
    .maybeSingle();

  if (existing?.soil_properties_fetched_at) {
    logger?.info(
      `[soil-enrich] field ${fieldId} already enriched at ${existing.soil_properties_fetched_at} — skipping`,
    );
    return { fieldId, action: "skipped", reason: "already-enriched" };
  }

  // ---- Fetch from provider ----
  let providerResult: Awaited<ReturnType<SoilPropertiesProvider["query"]>>;

  try {
    providerResult = await soilProvider.query(centroidLat, centroidLng);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    logger?.warn(
      `[soil-enrich] provider failure for field ${fieldId}: ${message}`,
    );
    return { fieldId, action: "failed", reason: message };
  }

  if (!providerResult) {
    logger?.warn(
      `[soil-enrich] provider returned null for field ${fieldId} at (${centroidLat}, ${centroidLng})`,
    );
    return {
      fieldId,
      action: "failed",
      reason: "provider-returned-null",
    };
  }

  // ---- Persist ----
  const now = new Date().toISOString();

  const { error: upsertError } = await db
    .from("field_soil_properties")
    .upsert(
      {
        field_id: fieldId,
        field_capacity_pct: providerResult.aggregateFcPct,
        wilting_point_pct: providerResult.aggregateWpPct,
        soil_properties_fetched_at: now,
        updated_at: now,
      },
      { onConflict: "field_id" },
    );

  if (upsertError) {
    logger?.warn(
      `[soil-enrich] upsert error for field ${fieldId}: ${upsertError.message}`,
    );
    return { fieldId, action: "failed", reason: upsertError.message };
  }

  logger?.info(
    `[soil-enrich] enriched field ${fieldId} — FC=${providerResult.aggregateFcPct}%, WP=${providerResult.aggregateWpPct}%`,
  );

  return { fieldId, action: "enriched" };
}
