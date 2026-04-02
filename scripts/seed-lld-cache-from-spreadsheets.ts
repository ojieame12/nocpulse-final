/**
 * Seed quarter-level LLD cache rows from spreadsheet imports.
 *
 * Usage:
 *   pnpm seed:lld-cache -- /absolute/path/to/file.xlsx [/absolute/path/to/file2.xlsx]
 */

import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import {
  createDefaultSpreadsheetWorkbookReader,
  formatLld,
  previewSpreadsheetImportFile,
  resolveSyntheticLldBoundary,
} from "@fieldpulse/module-field-intake";
import { loadEnvFile, readAppEnv } from "@fieldpulse/platform-config";
import { createSupabaseDatabaseClient } from "@fieldpulse/platform-db";

const UPSERT_BATCH_SIZE = 500;

type CacheRow = {
  quarter: "NE" | "NW" | "SE" | "SW";
  section: number;
  township: number;
  range: number;
  meridian: string;
  lld_code: string;
  boundary_geojson: ReturnType<typeof resolveSyntheticLldBoundary>["boundary"];
  centroid_lat: number;
  centroid_lng: number;
  bbox_north: number;
  bbox_south: number;
  bbox_east: number;
  bbox_west: number;
  source_key: string;
};

async function main() {
  const fileArgs = process.argv.slice(2).filter((value) => value !== "--");

  if (fileArgs.length === 0) {
    throw new Error(
      "Provide one or more spreadsheet paths: pnpm seed:lld-cache -- /path/to/file.xlsx",
    );
  }

  loadEnvFile({ fileName: ".env.local" });
  loadEnvFile();

  const env = readAppEnv(process.env);

  if (!env.supabase.url || !env.supabase.serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  const db = createSupabaseDatabaseClient({
    url: env.supabase.url,
    serviceKey: env.supabase.serviceRoleKey,
  });
  const reader = createDefaultSpreadsheetWorkbookReader();
  const rowsByLld = new Map<string, CacheRow>();

  for (const fileArg of fileArgs) {
    const filePath = resolve(fileArg);
    const fileBuffer = await readFile(filePath);
    const preview = await previewSpreadsheetImportFile({
      reader,
      file: {
        fileName: basename(filePath),
        buffer: fileBuffer.buffer.slice(
          fileBuffer.byteOffset,
          fileBuffer.byteOffset + fileBuffer.byteLength,
        ),
      },
    });

    if (preview.validRowCount === 0) {
      throw new Error(
        `${filePath} produced zero valid rows: ${
          preview.issues[0]?.message ?? "unknown parsing error"
        }`,
      );
    }

    const sourceKey = `spreadsheet-seed:${basename(filePath)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48)}`;

    for (const field of preview.fields) {
      for (const components of field.lldComponentsList) {
        const lldCode = formatLld(components);

        if (rowsByLld.has(lldCode)) {
          continue;
        }

        const synthetic = resolveSyntheticLldBoundary(components);

        rowsByLld.set(lldCode, {
          quarter: components.quarter,
          section: components.section,
          township: components.township,
          range: components.range,
          meridian: `W${components.meridian}`,
          lld_code: lldCode,
          boundary_geojson: synthetic.boundary,
          centroid_lat: synthetic.centroid[1],
          centroid_lng: synthetic.centroid[0],
          bbox_north: synthetic.bbox.north,
          bbox_south: synthetic.bbox.south,
          bbox_east: synthetic.bbox.east,
          bbox_west: synthetic.bbox.west,
          source_key: sourceKey,
        });
      }
    }

    console.log(
      `[lld-cache] ${basename(filePath)}: ${preview.validRowCount} valid rows, ${preview.fieldCount} field candidates, ${preview.issueCount} issues`,
    );
  }

  const cacheRows = Array.from(rowsByLld.values());

  for (let index = 0; index < cacheRows.length; index += UPSERT_BATCH_SIZE) {
    const batch = cacheRows.slice(index, index + UPSERT_BATCH_SIZE);
    const { error } = await db.from("lld_geocode_cache").upsert(batch, {
      onConflict: "quarter,section,township,range,meridian",
      ignoreDuplicates: false,
    });

    if (error) {
      throw new Error(
        `[lld-cache] batch ${index / UPSERT_BATCH_SIZE + 1} failed: ${error.message}`,
      );
    }
  }

  console.log(`[lld-cache] Upserted ${cacheRows.length} quarter-level cache rows.`);
}

void main().catch((error) => {
  console.error(
    `[seed-lld-cache-from-spreadsheets] ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exitCode = 1;
});
