/**
 * bootstrap-hope-creek.ts
 *
 * Seeds the Supabase database with:
 * 1. Hope Creek Farms workspace + 32 fields (merged multi-quarter boundaries)
 * 2. Crop context for each field (current season)
 * 3. SK-wide LLD geocode cache (~255K section-level entries)
 *
 * Usage:  pnpm bootstrap:hope-creek
 * Prereq: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env, migration 0032 applied
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "@fieldpulse/platform-config";
import { createSupabaseDatabaseClient } from "@fieldpulse/platform-db";
import { readAppEnv } from "@fieldpulse/platform-config";

const __dirname_ = typeof __dirname !== "undefined" ? __dirname : dirname(fileURLToPath(import.meta.url));

/* ── Seed data types ── */

type QuarterRecord = {
  quarter: "NE" | "NW" | "SE" | "SW";
  section: number;
  township: number;
  range: number;
  meridian: string;
};

type HopeCreekField = {
  name: string;
  crop: string;
  quarters: QuarterRecord[];
};

type TownshipRangeEntry = {
  township: number;
  range: number;
  meridian: string;
};

/* ── DLS grid math (mirrors field-intake/resolveSyntheticLldBoundary) ── */

const SECTION_WIDTH_M = 1_609.344;
const QUARTER_WIDTH_M = SECTION_WIDTH_M / 2;
const QUARTER_AREA_HA = (QUARTER_WIDTH_M * QUARTER_WIDTH_M) / 10_000;

const MERIDIAN_BASES: Record<string, { lat: number; lng: number }> = {
  W1: { lat: 49.0, lng: -101.35 },
  W2: { lat: 49.0, lng: -105.0 },
  W3: { lat: 49.0, lng: -106.95 },
  W4: { lat: 49.0, lng: -110.0 },
  W5: { lat: 49.0, lng: -114.0 },
  W6: { lat: 49.0, lng: -118.0 },
};

function metersToLatDeg(m: number) { return m / 111_320; }
function metersToLngDeg(m: number, lat: number) { return m / (111_320 * Math.cos((lat * Math.PI) / 180)); }

function getSectionCenter(section: number, township: number, range: number, meridian: string) {
  const base = MERIDIAN_BASES[meridian];
  if (!base) throw new Error(`Unknown meridian: ${meridian}`);
  const sectionIndex = section - 1;
  const sectionRow = Math.floor(sectionIndex / 6);
  const positionInRow = sectionIndex % 6;
  const sectionColumn = sectionRow % 2 === 0 ? 5 - positionInRow : positionInRow;
  const northingM = (township - 1) * SECTION_WIDTH_M * 6 + (sectionRow + 0.5) * SECTION_WIDTH_M;
  const westingM = (range - 1) * SECTION_WIDTH_M * 6 + (sectionColumn + 0.5) * SECTION_WIDTH_M;
  const lat = base.lat + metersToLatDeg(northingM);
  const lng = base.lng - metersToLngDeg(westingM, lat);
  return { lat, lng };
}

function getQuarterCenter(quarter: string, section: number, township: number, range: number, meridian: string) {
  const sc = getSectionCenter(section, township, range, meridian);
  const nOff = quarter.startsWith("N") ? SECTION_WIDTH_M / 4 : -SECTION_WIDTH_M / 4;
  const eOff = quarter.endsWith("E") ? SECTION_WIDTH_M / 4 : -SECTION_WIDTH_M / 4;
  return { lat: sc.lat + metersToLatDeg(nOff), lng: sc.lng + metersToLngDeg(eOff, sc.lat) };
}

type GeoPoint = [number, number];

function buildQuarterRing(center: { lat: number; lng: number }): GeoPoint[] {
  const hH = metersToLatDeg(QUARTER_WIDTH_M / 2);
  const hW = metersToLngDeg(QUARTER_WIDTH_M / 2, center.lat);
  return [
    [center.lng - hW, center.lat + hH],
    [center.lng + hW, center.lat + hH],
    [center.lng + hW, center.lat - hH],
    [center.lng - hW, center.lat - hH],
    [center.lng - hW, center.lat + hH],
  ];
}

function buildSectionRing(center: { lat: number; lng: number }): GeoPoint[] {
  const hH = metersToLatDeg(SECTION_WIDTH_M / 2);
  const hW = metersToLngDeg(SECTION_WIDTH_M / 2, center.lat);
  return [
    [center.lng - hW, center.lat + hH],
    [center.lng + hW, center.lat + hH],
    [center.lng + hW, center.lat - hH],
    [center.lng - hW, center.lat - hH],
    [center.lng - hW, center.lat + hH],
  ];
}

function mergeQuarters(quarters: QuarterRecord[]) {
  const polygons: GeoPoint[][] = [];
  let totalArea = 0, sumLat = 0, sumLng = 0;
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;

  for (const q of quarters) {
    const c = getQuarterCenter(q.quarter, q.section, q.township, q.range, q.meridian);
    polygons.push(buildQuarterRing(c));
    totalArea += QUARTER_AREA_HA;
    sumLat += c.lat;
    sumLng += c.lng;
    const hH = metersToLatDeg(QUARTER_WIDTH_M / 2);
    const hW = metersToLngDeg(QUARTER_WIDTH_M / 2, c.lat);
    minLat = Math.min(minLat, c.lat - hH);
    maxLat = Math.max(maxLat, c.lat + hH);
    minLng = Math.min(minLng, c.lng - hW);
    maxLng = Math.max(maxLng, c.lng + hW);
  }

  return {
    boundary: { type: "MultiPolygon", coordinates: polygons.map((r) => [r]) },
    areaHa: Math.round(totalArea * 100) / 100,
    centroidLat: sumLat / quarters.length,
    centroidLng: sumLng / quarters.length,
  };
}

function formatQuarterLld(q: QuarterRecord) {
  return `${q.quarter}-${String(q.section).padStart(2, "0")}-${String(q.township).padStart(3, "0")}-${String(q.range).padStart(2, "0")}-${q.meridian}`;
}

function round6(n: number) { return Math.round(n * 1e6) / 1e6; }

/* ── Main ── */

async function main() {
  loadEnvFile();
  const env = readAppEnv(process.env);

  if (!env.supabase.url || !env.supabase.serviceRoleKey) {
    throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
  }

  const db = createSupabaseDatabaseClient({
    url: env.supabase.url,
    serviceKey: env.supabase.serviceRoleKey,
  });

  const actorUserId = env.devActorUserId ?? "00000000-0000-4000-8000-000000000001";

  // Load seed JSON
  const fields: HopeCreekField[] = JSON.parse(
    readFileSync(resolve(__dirname_, "../data/seed/hope-creek-fields.json"), "utf-8"),
  );
  const skTownships: TownshipRangeEntry[] = JSON.parse(
    readFileSync(resolve(__dirname_, "../data/seed/sk-lld-townships.json"), "utf-8"),
  );

  console.log(`Loaded ${fields.length} fields, ${skTownships.length} township-range entries\n`);

  // ── 1. Ensure workspace ──
  const { data: existingWs } = await db
    .from("workspaces")
    .select("id")
    .eq("slug", "hope-creek-farms")
    .maybeSingle();

  let workspaceId: string;

  if (existingWs) {
    workspaceId = existingWs.id;
    console.log(`[workspace] Reusing: ${workspaceId}`);
  } else {
    const { data: newWs, error } = await db
      .from("workspaces")
      .insert({ slug: "hope-creek-farms", name: "Hope Creek Farms", created_by: actorUserId })
      .select("id")
      .single();
    if (error) throw new Error(`Workspace insert failed: ${error.message}`);
    workspaceId = newWs!.id;

    // Add actor as owner
    await db.from("workspace_memberships").insert({
      workspace_id: workspaceId,
      user_id: actorUserId,
      role: "owner",
    });

    console.log(`[workspace] Created: ${workspaceId}`);
  }

  // ── 2. Seed fields via create_field_record RPC ──
  let created = 0, skipped = 0;
  const fieldIdMap: Record<string, string> = {};

  for (const field of fields) {
    // Check if field already exists
    const { data: existing } = await db
      .from("fields")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("name", field.name)
      .maybeSingle();

    if (existing) {
      fieldIdMap[field.name] = existing.id;
      skipped++;
      console.log(`  = ${field.name} (exists)`);
      continue;
    }

    const merged = mergeQuarters(field.quarters);

    const { data: result, error } = await db.rpc("create_field_record", {
      target_workspace_id: workspaceId,
      field_name: field.name,
      field_area_ha: merged.areaHa,
      field_boundary_geojson: merged.boundary,
      actor_user_id: actorUserId,
    }).single();

    if (error) {
      console.error(`  ✗ ${field.name}: ${error.message}`);
      continue;
    }

    const fieldId = (result as any).id as string;
    fieldIdMap[field.name] = fieldId;

    // Set LLD
    const lld = field.quarters.map(formatQuarterLld).join(", ");
    await db
      .from("fields")
      .update({ legal_land_description: lld })
      .eq("id", fieldId)
      .eq("workspace_id", workspaceId);

    created++;
    console.log(`  + ${field.name} (${field.crop}, ${field.quarters.length}q, ${merged.areaHa} ha)`);
  }

  console.log(`\n[fields] ${created} created, ${skipped} skipped\n`);

  // ── 3. Seed crop contexts ──
  const currentYear = new Date().getFullYear();
  let cropCount = 0;

  for (const field of fields) {
    const fieldId = fieldIdMap[field.name];
    if (!fieldId) continue;

    const { error } = await db.from("field_crop_contexts").upsert(
      {
        workspace_id: workspaceId,
        field_id: fieldId,
        season_year: currentYear,
        crop_type: field.crop,
        source_key: "spreadsheet-seed:hope-creek",
      },
      { onConflict: "workspace_id,field_id,season_year" },
    );

    if (error) {
      console.warn(`  crop ${field.name}: ${error.message}`);
    } else {
      cropCount++;
    }
  }

  console.log(`[crops] ${cropCount} crop contexts upserted\n`);

  // ── 4. Seed LLD geocode cache ──
  console.log(`[lld-cache] Seeding geocode cache...`);

  // Phase A: Hope Creek quarter-level entries
  const quarterRows: Record<string, unknown>[] = [];
  for (const field of fields) {
    for (const q of field.quarters) {
      const c = getQuarterCenter(q.quarter, q.section, q.township, q.range, q.meridian);
      const hH = metersToLatDeg(QUARTER_WIDTH_M / 2);
      const hW = metersToLngDeg(QUARTER_WIDTH_M / 2, c.lat);
      quarterRows.push({
        quarter: q.quarter,
        section: q.section,
        township: q.township,
        range: q.range,
        meridian: q.meridian,
        lld_code: formatQuarterLld(q),
        boundary_geojson: {
          type: "MultiPolygon",
          coordinates: [[buildQuarterRing(c)]],
        },
        centroid_lat: round6(c.lat),
        centroid_lng: round6(c.lng),
        bbox_north: round6(c.lat + hH),
        bbox_south: round6(c.lat - hH),
        bbox_east: round6(c.lng + hW),
        bbox_west: round6(c.lng - hW),
        source_key: "spreadsheet-seed:hope-creek",
      });
    }
  }

  // Upsert quarter-level
  if (quarterRows.length > 0) {
    const { error } = await db.from("lld_geocode_cache").upsert(quarterRows, {
      onConflict: "quarter,section,township,range,meridian",
      ignoreDuplicates: true,
    });
    if (error) console.warn(`  quarter cache: ${error.message}`);
    else console.log(`  + ${quarterRows.length} quarter-level entries`);
  }

  // Phase B: SK-wide section-level entries (batch in chunks of 500)
  const BATCH = 500;
  let totalSections = 0;
  let sectionBatch: Record<string, unknown>[] = [];

  async function flushSections() {
    if (sectionBatch.length === 0) return;
    const { error } = await db.from("lld_geocode_cache").upsert(sectionBatch, {
      onConflict: "quarter,section,township,range,meridian",
      ignoreDuplicates: true,
    });
    if (error) {
      console.warn(`  section batch error: ${error.message}`);
    } else {
      totalSections += sectionBatch.length;
    }
    sectionBatch = [];
  }

  for (const entry of skTownships) {
    for (let sec = 1; sec <= 36; sec++) {
      try {
        const c = getSectionCenter(sec, entry.township, entry.range, entry.meridian);
        const hH = metersToLatDeg(SECTION_WIDTH_M / 2);
        const hW = metersToLngDeg(SECTION_WIDTH_M / 2, c.lat);
        sectionBatch.push({
          quarter: null,
          section: sec,
          township: entry.township,
          range: entry.range,
          meridian: entry.meridian,
          lld_code: `${String(sec).padStart(2, "0")}-${String(entry.township).padStart(3, "0")}-${String(entry.range).padStart(2, "0")}-${entry.meridian}`,
          boundary_geojson: {
            type: "MultiPolygon",
            coordinates: [[buildSectionRing(c)]],
          },
          centroid_lat: round6(c.lat),
          centroid_lng: round6(c.lng),
          bbox_north: round6(c.lat + hH),
          bbox_south: round6(c.lat - hH),
          bbox_east: round6(c.lng + hW),
          bbox_west: round6(c.lng - hW),
          source_key: "spreadsheet-seed:sk-llds",
        });
        if (sectionBatch.length >= BATCH) await flushSections();
      } catch {
        // skip invalid combos
      }
    }
  }
  await flushSections();

  console.log(`  + ${totalSections} section-level entries`);
  console.log(`\n[done] Hope Creek Farms seeded successfully.`);
  console.log(`  Workspace: hope-creek-farms (${workspaceId})`);
  console.log(`  Fields: ${created} new + ${skipped} existing = ${fields.length}`);
  console.log(`  Crops: ${cropCount}`);
  console.log(`  LLD cache: ${quarterRows.length} quarters + ${totalSections} sections`);
}

void main().catch((err: unknown) => {
  console.error(`[bootstrap-hope-creek] ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
});
