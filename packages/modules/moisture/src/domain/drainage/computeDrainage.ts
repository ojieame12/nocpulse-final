/**
 * Drainage decay function for post-rain water storage.
 *
 * After heavy rain, soil moisture temporarily exceeds field capacity.
 * Gravitational drainage follows exponential decay:
 *   storage(t) = FC + excess * e^(-t/tau)
 * where tau is a texture-dependent time constant in hours.
 */

export type SoilTextureClass =
  | "sand"
  | "sandy-loam"
  | "loam"
  | "clay-loam"
  | "clay"
  | "unknown";

/** Drainage time constants (tau) in hours, keyed by soil texture class. */
const DRAINAGE_TAU_HOURS: Record<SoilTextureClass, number> = {
  sand: 6,
  "sandy-loam": 12,
  loam: 18,
  "clay-loam": 30,
  clay: 48,
  unknown: 18, // default to loam
};

/**
 * Compute how much water drains from above field capacity over a time period.
 * Uses exponential decay: storage(t) = FC + excess * e^(-t/tau)
 * where tau is the drainage time constant in hours.
 *
 * @param currentStorageMm  Current soil water storage in mm.
 * @param fieldCapacityMm   Field capacity in mm.
 * @param hoursSinceRain    Hours elapsed since the rain event.
 * @param textureClass      Soil texture class (defaults to "unknown" / loam).
 * @returns The amount of water drained in mm (always >= 0).
 */
export function computeDrainageMm(
  currentStorageMm: number,
  fieldCapacityMm: number,
  hoursSinceRain: number,
  textureClass?: SoilTextureClass,
): number {
  if (currentStorageMm <= fieldCapacityMm) {
    return 0;
  }

  const tau = DRAINAGE_TAU_HOURS[textureClass ?? "unknown"];
  const excessMm = currentStorageMm - fieldCapacityMm;
  const drainedMm = excessMm * (1 - Math.exp(-hoursSinceRain / tau));

  return drainedMm;
}

/**
 * Infer a soil texture class from field capacity and wilting point percentages.
 *
 * Approximate mapping based on field capacity:
 *   FC < 15%  -> sand
 *   FC 15-25% -> sandy-loam
 *   FC 25-35% -> loam
 *   FC 35-45% -> clay-loam
 *   FC > 45%  -> clay
 *   null      -> unknown
 */
export function inferTextureClass(
  fieldCapacityPct: number | null,
  wiltingPointPct: number | null,
): SoilTextureClass {
  if (fieldCapacityPct === null || fieldCapacityPct === undefined) {
    return "unknown";
  }

  if (fieldCapacityPct < 15) return "sand";
  if (fieldCapacityPct < 25) return "sandy-loam";
  if (fieldCapacityPct < 35) return "loam";
  if (fieldCapacityPct < 45) return "clay-loam";
  return "clay";
}
