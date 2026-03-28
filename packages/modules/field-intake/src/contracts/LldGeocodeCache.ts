import type { FieldBoundary } from "@fieldpulse/module-fields";
import type { LldComponents } from "./LldComponents";
import type { GeoBoundingBox } from "./LldLookupResult";

/**
 * Cached geocode result for a legal land description.
 * Returned by the LLD geocode cache when a pre-computed entry exists.
 */
export type CachedLldGeocode = {
  lldCode: string;
  boundary: FieldBoundary;
  centroidLat: number;
  centroidLng: number;
  bbox: GeoBoundingBox;
};

/**
 * Port for looking up pre-computed LLD geocode entries.
 *
 * Implementations can read from the `lld_geocode_cache` table (Supabase),
 * an in-memory map, or any other backing store.
 */
export type LldGeocodeCache = {
  lookup(components: LldComponents): Promise<CachedLldGeocode | null>;
};
