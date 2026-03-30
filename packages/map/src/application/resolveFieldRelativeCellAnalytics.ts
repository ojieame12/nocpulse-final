import type { CellAnomalyClass } from "../domain/render/FieldAgronomicSurfaceRenderModel";

function interpolatePercentile(sortedValues: readonly number[], fraction: number) {
  if (sortedValues.length === 0) {
    return null;
  }

  const clampedFraction = Math.min(1, Math.max(0, fraction));
  const rawIndex = (sortedValues.length - 1) * clampedFraction;
  const lowerIndex = Math.floor(rawIndex);
  const upperIndex = Math.ceil(rawIndex);
  const lowerValue = sortedValues[lowerIndex]!;
  const upperValue = sortedValues[upperIndex]!;

  if (lowerIndex === upperIndex) {
    return lowerValue;
  }

  const weight = rawIndex - lowerIndex;
  return lowerValue + (upperValue - lowerValue) * weight;
}

function roundToSingleDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function resolvePercentiles(values: readonly number[]) {
  if (values.length === 0) {
    return [];
  }

  if (values.length === 1) {
    return [50];
  }

  const ranked = values
    .map((value, index) => ({ value, index }))
    .sort((left, right) => left.value - right.value);

  const percentiles = new Array<number>(values.length);

  for (let pointer = 0; pointer < ranked.length; ) {
    let end = pointer;
    while (end + 1 < ranked.length && ranked[end + 1]!.value === ranked[pointer]!.value) {
      end += 1;
    }

    const midpoint = (pointer + end) / 2;
    const percentile = roundToSingleDecimal((midpoint / (ranked.length - 1)) * 100);

    for (let index = pointer; index <= end; index += 1) {
      percentiles[ranked[index]!.index] = percentile;
    }

    pointer = end + 1;
  }

  return percentiles;
}

function classifyAnomaly(
  value: number,
  percentileInField: number,
  median: number,
  interquartileRange: number,
): CellAnomalyClass {
  const deltaFromMedian = value - median;
  const nearThreshold = Math.max(2.5, interquartileRange * 0.35);
  const outerThreshold = Math.max(3.5, nearThreshold * 0.6);

  if (percentileInField >= 75 && deltaFromMedian >= outerThreshold) {
    return "above-field";
  }

  if (percentileInField <= 25 && deltaFromMedian <= -outerThreshold) {
    return "below-field";
  }

  if (Math.abs(deltaFromMedian) <= nearThreshold) {
    return "near-field";
  }

  return deltaFromMedian > 0 ? "above-field" : "below-field";
}

export function resolveFieldRelativeCellAnalytics(values: readonly number[]) {
  if (values.length === 0) {
    return [];
  }

  const sortedValues = [...values].sort((left, right) => left - right);
  const percentileRanks = resolvePercentiles(values);
  const median = interpolatePercentile(sortedValues, 0.5) ?? values[0] ?? 0;
  const q1 = interpolatePercentile(sortedValues, 0.25) ?? median;
  const q3 = interpolatePercentile(sortedValues, 0.75) ?? median;
  const interquartileRange = Math.max(0, q3 - q1);

  return values.map((value, index) => {
    const percentileInField = percentileRanks[index] ?? 50;

    return {
      percentileInField,
      anomalyClass: classifyAnomaly(
        value,
        percentileInField,
        median,
        interquartileRange,
      ),
    };
  });
}
