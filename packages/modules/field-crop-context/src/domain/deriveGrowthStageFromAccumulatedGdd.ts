import type { StageProgressionThreshold } from "../contracts/RefreshFieldCropStageInput";

export function deriveGrowthStageFromAccumulatedGdd(
  accumulatedGdd: number,
  thresholds: readonly StageProgressionThreshold[],
) {
  const ordered = [...thresholds].sort(
    (left, right) => left.minAccumulatedGdd - right.minAccumulatedGdd,
  );
  let selected = ordered[0]?.stage ?? "vegetative";

  for (const threshold of ordered) {
    if (accumulatedGdd >= threshold.minAccumulatedGdd) {
      selected = threshold.stage;
    }
  }

  return selected;
}
