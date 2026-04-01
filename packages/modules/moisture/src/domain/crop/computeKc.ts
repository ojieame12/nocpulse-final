/**
 * FAO-56 crop coefficient (Kc) lookup.
 *
 * Maps crop type and growth stage to the appropriate Kc value from
 * FAO Irrigation and Drainage Paper No. 56, Table 12.
 *
 * Kc adjusts reference evapotranspiration (ET₀) to actual crop ET:
 *   ETc = ET₀ × Kc
 */

type KcPhase = "initial" | "mid" | "end";

type KcEntry = Readonly<{
  initial: number;
  mid: number;
  end: number;
}>;

/**
 * FAO-56 Table 12 Kc values by crop.
 * Keys are normalized to lowercase.
 */
const FAO56_KC_TABLE: Readonly<Record<string, KcEntry>> = {
  maize: { initial: 0.3, mid: 1.2, end: 0.5 },
  corn: { initial: 0.3, mid: 1.2, end: 0.5 },
  wheat: { initial: 0.3, mid: 1.15, end: 0.25 },
  soybean: { initial: 0.4, mid: 1.15, end: 0.5 },
  canola: { initial: 0.35, mid: 1.15, end: 0.35 },
  barley: { initial: 0.3, mid: 1.15, end: 0.25 },
};

const DEFAULT_KC_ENTRY: KcEntry = { initial: 1.0, mid: 1.0, end: 1.0 };

/**
 * Maps growth stage strings (from prairieDefaultRulePack) to Kc phases.
 *
 * - pre-seed, vegetative → initial (crop establishing, low canopy)
 * - flowering → mid (full canopy, peak water demand)
 * - ripening → end (senescence, reduced transpiration)
 */
function resolveKcPhase(growthStage: string | null): KcPhase {
  if (growthStage == null) {
    return "mid";
  }

  const normalized = growthStage.toLowerCase().trim();

  switch (normalized) {
    case "pre-seed":
    case "vegetative":
      return "initial";
    case "flowering":
      return "mid";
    case "ripening":
      return "end";
    default:
      return "mid";
  }
}

/**
 * Returns the FAO-56 Kc crop coefficient for the given crop type and growth stage.
 *
 * When crop type is unknown or null, returns 1.0 (grass reference — no adjustment).
 * When growth stage is unknown or null, defaults to mid-season Kc.
 */
export function computeKc(
  cropType: string | null,
  growthStage: string | null,
): number {
  const phase = resolveKcPhase(growthStage);

  if (cropType == null) {
    return DEFAULT_KC_ENTRY[phase];
  }

  const normalized = cropType.toLowerCase().trim();
  const entry = FAO56_KC_TABLE[normalized] ?? DEFAULT_KC_ENTRY;

  return entry[phase];
}
