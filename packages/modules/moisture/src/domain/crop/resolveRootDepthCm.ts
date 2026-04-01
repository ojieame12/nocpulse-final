/**
 * Returns the effective root zone depth in cm based on crop type and growth stage.
 * Used to determine which soil layers contribute to the root zone moisture estimate.
 *
 * Default depths by stage:
 *   pre-seed    → 15 cm  (seed zone only)
 *   vegetative  → 25 cm  (roots establishing)
 *   flowering   → 40 cm  (full root development)
 *   ripening    → 35 cm  (roots senescing slightly)
 *   null/unknown → 30 cm (standard assumption)
 *
 * Crop-specific overrides at flowering depth for known deep/shallow rooters:
 *   corn/maize  → 50 cm
 *   wheat       → 35 cm
 *   canola      → 40 cm
 *   soybean     → 35 cm
 *   barley      → 30 cm
 */

type StageDepths = Readonly<{
  "pre-seed": number;
  vegetative: number;
  flowering: number;
  ripening: number;
}>;

const DEFAULT_STAGE_DEPTHS: StageDepths = {
  "pre-seed": 15,
  vegetative: 25,
  flowering: 40,
  ripening: 35,
};

/**
 * Crop-specific overrides. Each entry only needs to specify stages that
 * differ from the defaults — the lookup merges with defaults at runtime.
 */
const CROP_OVERRIDES: Readonly<Record<string, Partial<StageDepths>>> = {
  corn: { flowering: 50, vegetative: 30, ripening: 40 },
  maize: { flowering: 50, vegetative: 30, ripening: 40 },
  wheat: { flowering: 35 },
  canola: { flowering: 40 },
  soybean: { flowering: 35 },
  barley: { flowering: 30, vegetative: 20, ripening: 25 },
};

const DEFAULT_DEPTH_CM = 30;

function normalizeStage(
  stage: string | null | undefined,
): keyof StageDepths | null {
  if (stage == null) return null;
  const normalized = stage.toLowerCase().trim();
  if (
    normalized === "pre-seed" ||
    normalized === "vegetative" ||
    normalized === "flowering" ||
    normalized === "ripening"
  ) {
    return normalized as keyof StageDepths;
  }
  return null;
}

export function resolveRootDepthCm(
  cropType: string | null | undefined,
  growthStage: string | null | undefined,
): number {
  const stage = normalizeStage(growthStage);

  if (stage === null) {
    return DEFAULT_DEPTH_CM;
  }

  const cropKey = cropType?.toLowerCase().trim() ?? null;
  const cropOverride = cropKey !== null ? CROP_OVERRIDES[cropKey] : undefined;
  const depth = cropOverride?.[stage] ?? DEFAULT_STAGE_DEPTHS[stage];

  return depth;
}
