import { normalizeLldCode } from "../domain/lld/normalizeLldCode";
import { resolveSyntheticLldBoundary } from "../domain/lld/resolveSyntheticLldBoundary";
import { deriveFieldGeometry } from "../domain/geometry/deriveFieldGeometry";
import type { LldGeocodeCache } from "../contracts/LldGeocodeCache";
import type {
  LookupLldBoundaryInput,
  LldLookupResult,
} from "../contracts/LldLookupResult";

export type LookupLldBoundaryDeps = {
  geocodeCache?: LldGeocodeCache;
};

/**
 * Resolve an LLD code to a field draft with boundary, centroid, and bbox.
 *
 * When a geocode cache is provided, the function checks for a pre-computed
 * entry first (resolution = "cached"). Falls back to computing a synthetic
 * boundary from DLS grid math if no cache hit.
 */
export async function lookupLldBoundary(
  input: LookupLldBoundaryInput,
  deps?: LookupLldBoundaryDeps,
): Promise<LldLookupResult> {
  const parsed = normalizeLldCode(input.code);

  const fieldName =
    input.suggestedFieldName?.trim() ||
    `Quarter ${parsed.normalized.replace(/-/g, " ")}`;

  // Try cache first
  if (deps?.geocodeCache) {
    const cached = await deps.geocodeCache.lookup(parsed.components);
    if (cached) {
      const geometry = deriveFieldGeometry(cached.boundary);

      return {
        parsed,
        draft: {
          name: fieldName,
          areaHa: geometry.areaHa,
          boundary: cached.boundary,
        },
        centroid: geometry.centroid,
        bbox: geometry.bbox,
        resolution: "cached",
      };
    }
  }

  // Fallback: compute synthetic boundary from DLS grid math
  const boundary = resolveSyntheticLldBoundary(parsed.components);

  return {
    parsed,
    draft: {
      name: fieldName,
      areaHa: boundary.areaHa,
      boundary: boundary.boundary,
    },
    centroid: boundary.centroid,
    bbox: boundary.bbox,
    resolution: "synthetic",
  };
}
