import type { DatabaseClient } from "@fieldpulse/platform-db";
import type { FieldBoundary } from "@fieldpulse/module-fields";
import type { LldComponents } from "../contracts/LldComponents";
import type { LldGeocodeCache, CachedLldGeocode } from "../contracts/LldGeocodeCache";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toFieldBoundary(value: unknown): FieldBoundary {
  if (!isRecord(value) || value.type !== "MultiPolygon" || !Array.isArray(value.coordinates)) {
    throw new Error("[field-intake] invalid cached LLD boundary geojson");
  }

  return value as FieldBoundary;
}

/**
 * Supabase-backed implementation of LldGeocodeCache.
 * Calls the `lookup_lld_geocode` RPC exposed by migration 0032.
 */
export function createSupabaseLldGeocodeCache(
  db: DatabaseClient,
): LldGeocodeCache {
  return {
    async lookup(components: LldComponents): Promise<CachedLldGeocode | null> {
      const { data, error } = await db
        .rpc("lookup_lld_geocode", {
          target_quarter: components.quarter,
          target_section: components.section,
          target_township: components.township,
          target_range: components.range,
          target_meridian: `W${components.meridian}`,
        })
        .maybeSingle();

      if (error) {
        throw new Error(
          `[field-intake] lld geocode cache lookup failed: ${error.message}`,
        );
      }

      if (!data) {
        return null;
      }

      const row = data as {
        lld_code: string;
        boundary_geojson: unknown;
        centroid_lat: number;
        centroid_lng: number;
        bbox_north: number;
        bbox_south: number;
        bbox_east: number;
        bbox_west: number;
      };

      return {
        lldCode: row.lld_code,
        boundary: toFieldBoundary(row.boundary_geojson),
        centroidLat: Number(row.centroid_lat),
        centroidLng: Number(row.centroid_lng),
        bbox: {
          north: Number(row.bbox_north),
          south: Number(row.bbox_south),
          east: Number(row.bbox_east),
          west: Number(row.bbox_west),
        },
      };
    },
  };
}
