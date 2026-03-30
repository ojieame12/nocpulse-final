type NormalizeExtrusionHeightSpreadOptions = {
  softMinRangeM: number;
  maxBlend: number;
  minHeightM: number;
  maxHeightM: number;
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function normalizeExtrusionHeightSpread(
  heights: readonly number[],
  {
    softMinRangeM,
    maxBlend,
    minHeightM,
    maxHeightM,
  }: NormalizeExtrusionHeightSpreadOptions,
): number[] {
  if (heights.length < 2) {
    return [...heights];
  }

  const minHeight = Math.min(...heights);
  const maxHeight = Math.max(...heights);
  const currentRange = maxHeight - minHeight;

  if (!Number.isFinite(currentRange) || currentRange <= 0.001) {
    return [...heights];
  }

  if (currentRange >= softMinRangeM) {
    return [...heights];
  }

  const midpoint = (minHeight + maxHeight) / 2;
  const normalizedMin = midpoint - softMinRangeM / 2;
  const compression = clamp(1 - currentRange / softMinRangeM, 0, 1);
  const blend = maxBlend * compression;

  return heights.map((height) => {
    const ratio = clamp((height - minHeight) / currentRange, 0, 1);
    const normalizedHeight = normalizedMin + ratio * softMinRangeM;

    return clamp(
      height * (1 - blend) + normalizedHeight * blend,
      minHeightM,
      maxHeightM,
    );
  });
}
