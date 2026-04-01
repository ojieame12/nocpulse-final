/**
 * Depth schema translation layer for Open-Meteo soil moisture data.
 *
 * Open-Meteo's forecast API and historical archive API use different depth
 * layer schemas. This module reconciles both into a canonical set of depth
 * ranges so that current readings can be compared against historical baselines
 * without apples-to-oranges depth mismatches.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CanonicalDepthRange = "0-10cm" | "10-30cm" | "30-60cm" | "60-100cm";

export type DepthSchema = "forecast" | "archive";

export interface DepthLayer {
  readonly key: string;
  readonly topCm: number;
  readonly bottomCm: number;
}

// ---------------------------------------------------------------------------
// Layer definitions
// ---------------------------------------------------------------------------

const FORECAST_LAYERS: readonly DepthLayer[] = [
  { key: "soil_moisture_0_to_1cm", topCm: 0, bottomCm: 1 },
  { key: "soil_moisture_1_to_3cm", topCm: 1, bottomCm: 3 },
  { key: "soil_moisture_3_to_9cm", topCm: 3, bottomCm: 9 },
  { key: "soil_moisture_9_to_27cm", topCm: 9, bottomCm: 27 },
  { key: "soil_moisture_27_to_81cm", topCm: 27, bottomCm: 81 },
] as const;

const ARCHIVE_LAYERS: readonly DepthLayer[] = [
  { key: "soil_moisture_0_to_7cm", topCm: 0, bottomCm: 7 },
  { key: "soil_moisture_7_to_28cm", topCm: 7, bottomCm: 28 },
  { key: "soil_moisture_28_to_100cm", topCm: 28, bottomCm: 100 },
  { key: "soil_moisture_100_to_255cm", topCm: 100, bottomCm: 255 },
] as const;

const SCHEMA_LAYERS: Record<DepthSchema, readonly DepthLayer[]> = {
  forecast: FORECAST_LAYERS,
  archive: ARCHIVE_LAYERS,
};

// ---------------------------------------------------------------------------
// Canonical depth range boundaries (for convenience / lookup)
// ---------------------------------------------------------------------------

export const CANONICAL_RANGES: Record<CanonicalDepthRange, { topCm: number; bottomCm: number }> = {
  "0-10cm": { topCm: 0, bottomCm: 10 },
  "10-30cm": { topCm: 10, bottomCm: 30 },
  "30-60cm": { topCm: 30, bottomCm: 60 },
  "60-100cm": { topCm: 60, bottomCm: 100 },
};

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/** Return the source layers for a given schema. */
export function getLayersForSchema(schema: DepthSchema): readonly DepthLayer[] {
  return SCHEMA_LAYERS[schema];
}

// ---------------------------------------------------------------------------
// Core algorithm
// ---------------------------------------------------------------------------

/**
 * Given a set of layer values (keyed by Open-Meteo field name) and a target
 * depth range, compute the depth-weighted average moisture.
 *
 * The weighting is by overlap: if a layer spans 9-27 cm and the target is
 * 10-30 cm, the overlap is 10-27 cm = 17 cm out of the target's 20 cm range.
 *
 * Layers whose value is `null` or missing from `layerValues` are skipped and
 * their weight is redistributed across the remaining layers.
 *
 * Returns `null` when no layer has both a non-null value and positive overlap
 * with the target range.
 */
export function resolveCanonicalMoisture(
  layerValues: Record<string, number | null>,
  schema: DepthSchema,
  targetTopCm: number,
  targetBottomCm: number,
): number | null {
  const layers = SCHEMA_LAYERS[schema];
  const targetRangeCm = targetBottomCm - targetTopCm;

  if (targetRangeCm <= 0) {
    return null;
  }

  let weightedSum = 0;
  let totalWeight = 0;

  for (const layer of layers) {
    const overlapCm = Math.max(
      0,
      Math.min(layer.bottomCm, targetBottomCm) - Math.max(layer.topCm, targetTopCm),
    );

    if (overlapCm === 0) {
      continue;
    }

    const value = layerValues[layer.key];

    if (value == null) {
      continue;
    }

    const weight = overlapCm / targetRangeCm;
    weightedSum += value * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) {
    return null;
  }

  // Redistribute weights so they sum to 1 when some layers were skipped.
  return weightedSum / totalWeight;
}

// ---------------------------------------------------------------------------
// Convenience: root-zone moisture
// ---------------------------------------------------------------------------

/**
 * Resolve root-zone soil moisture for a given schema.
 *
 * @param layerValues  Record keyed by Open-Meteo field names.
 * @param schema       Which Open-Meteo API the values came from.
 * @param depthCm      Root-zone depth in cm (default 30).
 */
export function resolveRootZoneMoisture(
  layerValues: Record<string, number | null>,
  schema: DepthSchema,
  depthCm: number = 30,
): number | null {
  return resolveCanonicalMoisture(layerValues, schema, 0, depthCm);
}
