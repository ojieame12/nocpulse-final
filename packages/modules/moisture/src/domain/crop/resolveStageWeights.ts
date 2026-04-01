/**
 * Growth-stage-gated satellite signal weights.
 *
 * Determines the relative contribution of NDMI (optical moisture index)
 * vs SAR (radar backscatter) when blending satellite observations into
 * the moisture model. The optimal blend depends on canopy development:
 *
 * - Early stages: bare/sparse soil favors SAR penetration
 * - Mid stages: full canopy makes NDMI the stronger moisture proxy
 * - Late stages: mixed signal as canopy dries, lean toward SAR
 */

export type StageWeights = Readonly<{
  ndmiWeight: number;
  sarWeight: number;
}>;

/**
 * Returns satellite signal blend weights based on the current growth stage.
 *
 * Weights always sum to 1.0. When growth stage is unknown, an equal
 * 0.5/0.5 blend is returned as a neutral fallback.
 */
export function resolveStageWeights(
  growthStage: string | null,
): StageWeights {
  if (growthStage == null) {
    return { ndmiWeight: 0.5, sarWeight: 0.5 };
  }

  const normalized = growthStage.toLowerCase().trim();

  switch (normalized) {
    // Early: SAR sees bare soil better
    case "pre-seed":
    case "vegetative":
      return { ndmiWeight: 0.2, sarWeight: 0.8 };

    // Mid: NDMI reads canopy water content
    case "flowering":
      return { ndmiWeight: 0.7, sarWeight: 0.3 };

    // Late: mixed, lean SAR
    case "ripening":
      return { ndmiWeight: 0.4, sarWeight: 0.6 };

    // Unknown stage string
    default:
      return { ndmiWeight: 0.5, sarWeight: 0.5 };
  }
}
