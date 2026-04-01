import { createSoilPropertiesProvider } from "@fieldpulse/module-soil";
import type { SoilPropertiesProvider } from "@fieldpulse/module-soil";
import { createSupabaseDatabaseClient } from "@fieldpulse/platform-db";
import { createServerRuntime } from "@fieldpulse/platform-runtime";
import { enrichFieldSoilProperties } from "./soilEnrich";
import { loadWorkerEnv } from "./runtime/loadEnv";
import {
  parseCliArgs,
  readBooleanFlag,
  readNumberFlag,
} from "./runtime/parseCliArgs";

/* ------------------------------------------------------------------ */
/* Rate-limit helper                                                  */
/* ------------------------------------------------------------------ */

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const RATE_LIMIT_DELAY_MS = 2_000;

/* ------------------------------------------------------------------ */
/* Main                                                               */
/* ------------------------------------------------------------------ */

async function main() {
  loadWorkerEnv();
  const runtime = createServerRuntime(process.env);
  const args = parseCliArgs();
  const asJson = readBooleanFlag(args, "json");
  const dryRun = readBooleanFlag(args, "dry-run");
  const limit = readNumberFlag(args, "limit");

  if (runtime.mode !== "supabase") {
    throw new Error("[soil-backfill] Supabase runtime is not configured");
  }

  const db = createSupabaseDatabaseClient({
    url: runtime.env.supabase.url!,
    serviceKey: runtime.env.supabase.serviceRoleKey!,
  });

  // Fetch all fields that have NOT been enriched yet.
  // Join with fields table to get boundary/label_point for centroid.
  const { data: fieldsNeedingEnrichment, error: queryError } = await db
    .from("fields")
    .select("id, workspace_id, name, label_point")
    .order("created_at", { ascending: true });

  if (queryError) {
    throw new Error(
      `[soil-backfill] failed to list fields: ${queryError.message}`,
    );
  }

  if (!fieldsNeedingEnrichment || fieldsNeedingEnrichment.length === 0) {
    console.log("[soil-backfill] no fields found");
    return;
  }

  // Filter to fields missing soil properties
  const fieldIds = fieldsNeedingEnrichment.map((f) => f.id);
  const { data: existingSoilProps } = await db
    .from("field_soil_properties")
    .select("field_id, soil_properties_fetched_at")
    .in("field_id", fieldIds)
    .not("soil_properties_fetched_at", "is", null);

  const alreadyEnrichedIds = new Set(
    (existingSoilProps ?? []).map((row) => row.field_id),
  );

  const candidates = fieldsNeedingEnrichment.filter(
    (f) => !alreadyEnrichedIds.has(f.id),
  );

  const capped = limit ? candidates.slice(0, limit) : candidates;
  const totalCount = capped.length;

  console.log(
    `[soil-backfill] found ${totalCount} fields needing soil enrichment (${alreadyEnrichedIds.size} already enriched)`,
  );

  if (dryRun) {
    console.log("[soil-backfill] dry-run mode — no writes will be made");
    if (asJson) {
      console.log(
        JSON.stringify(
          {
            totalCandidates: totalCount,
            alreadyEnriched: alreadyEnrichedIds.size,
            fieldIds: capped.map((f) => f.id),
          },
          null,
          2,
        ),
      );
    }
    return;
  }

  const soilProvider: SoilPropertiesProvider = createSoilPropertiesProvider({
    enableRestFallback: true,
    restBaseUrl: runtime.env.soil.soilGridsBaseUrl,
  });

  const logger = {
    info(msg: string) {
      console.log(msg);
    },
    warn(msg: string) {
      console.warn(msg);
    },
  };

  let enrichedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < capped.length; i++) {
    const field = capped[i];

    // Extract centroid from label_point (GeoJSON point: [lng, lat])
    const labelPoint = field.label_point as unknown as
      | readonly [number, number]
      | null;

    if (!labelPoint || labelPoint.length < 2) {
      logger.warn(
        `[soil-backfill] field ${field.id} (${field.name}) has no label_point — skipping`,
      );
      skippedCount++;
      continue;
    }

    const centroidLng = labelPoint[0];
    const centroidLat = labelPoint[1];

    // Rate limit: wait before each request (except the first)
    if (i > 0) {
      await sleep(RATE_LIMIT_DELAY_MS);
    }

    const result = await enrichFieldSoilProperties(
      { fieldId: field.id, centroidLat, centroidLng },
      { db, soilProvider, logger },
    );

    if (result.action === "enriched") {
      enrichedCount++;
    } else if (result.action === "failed") {
      failedCount++;
    } else {
      skippedCount++;
    }

    // Log progress
    const processed = i + 1;
    console.log(
      `[soil-backfill] Enriched ${enrichedCount}/${totalCount} fields (processed ${processed}/${totalCount}, ${failedCount} failed, ${skippedCount} skipped)`,
    );
  }

  const summary = {
    totalCandidates: totalCount,
    enriched: enrichedCount,
    failed: failedCount,
    skipped: skippedCount,
    alreadyEnriched: alreadyEnrichedIds.size,
  };

  if (asJson) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(
      [
        "",
        "--- Soil Properties Backfill Summary ---",
        `Total candidates: ${summary.totalCandidates}`,
        `Enriched:         ${summary.enriched}`,
        `Failed:           ${summary.failed}`,
        `Skipped:          ${summary.skipped}`,
        `Already enriched: ${summary.alreadyEnriched}`,
      ].join("\n"),
    );
  }
}

void main().catch((error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : "Unknown soil properties backfill failure";
  console.error(`[soil-backfill] ${message}`);
  process.exitCode = 1;
});
