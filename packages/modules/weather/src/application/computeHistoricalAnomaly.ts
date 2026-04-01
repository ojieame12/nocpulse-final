/**
 * Compute how current soil moisture compares to historical normals.
 *
 * Uses a rolling day-of-year window across multiple years of Open-Meteo
 * archive data to determine whether conditions are drier or wetter than
 * typical for the same time of year.
 */

import type { HistoricalSoilMoistureResult } from "../infrastructure/createOpenMeteoHistoricalClient";
import { resolveRootZoneMoisture } from "../domain/depthTranslation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HistoricalAnomalyResult = {
  currentPct: number;
  historicalMedianPct: number;
  departurePct: number; // positive = drier than normal
  percentileRank: number; // 0-100, "drier than X% of years"
  description: string; // e.g., "Drier than 82% of years for early April"
  dateRange: string; // e.g., "5-year average"
  dayOfYearWindow: number; // ±days used for rolling window
};

export type ComputeHistoricalAnomalyOptions = {
  /** Half-width of the day-of-year window (default 15). */
  windowDays?: number;
  /** Root-zone depth in cm (default 30). */
  targetDepthCm?: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_WINDOW_DAYS = 15;
const DEFAULT_DEPTH_CM = 30;
const MIN_DATA_POINTS = 5;

/**
 * Return the day-of-year (1–366) for a given date.
 * Handles leap years correctly via the built-in Date math.
 */
function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Check whether `candidate` day-of-year falls within ±windowDays of `target`
 * day-of-year, wrapping around the year boundary (366 days max).
 */
function isWithinWindow(
  candidate: number,
  target: number,
  windowDays: number,
): boolean {
  const maxDoy = 366;
  const diff = Math.abs(candidate - target);
  const wrappedDiff = Math.min(diff, maxDoy - diff);
  return wrappedDiff <= windowDays;
}

/**
 * Compute the median of a sorted array of numbers.
 */
function median(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Compute the percentile rank of `value` within `sorted` (ascending).
 * Returns a number between 0 and 100 indicating what percentage of values
 * in the distribution are less than or equal to `value`.
 */
function percentileRankOf(value: number, sorted: number[]): number {
  if (sorted.length === 0) return 50;
  let count = 0;
  for (const v of sorted) {
    if (v <= value) count += 1;
  }
  return (count / sorted.length) * 100;
}

/**
 * Format a month-period description like "early April", "mid March", "late June".
 */
function describeTimeOfYear(date: Date): string {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const day = date.getDate();
  const month = months[date.getMonth()];
  if (day <= 10) return `early ${month}`;
  if (day <= 20) return `mid ${month}`;
  return `late ${month}`;
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export function computeHistoricalAnomaly(
  currentMoisturePct: number,
  historicalData: HistoricalSoilMoistureResult,
  targetDate: Date,
  options?: ComputeHistoricalAnomalyOptions,
): HistoricalAnomalyResult | null {
  const windowDays = options?.windowDays ?? DEFAULT_WINDOW_DAYS;
  const depthCm = options?.targetDepthCm ?? DEFAULT_DEPTH_CM;
  const targetDoy = dayOfYear(targetDate);

  // Collect root-zone moisture values that fall within the day-of-year window
  const windowValues: number[] = [];

  for (const entry of historicalData.dailyValues) {
    // Parse YYYY-MM-DD without timezone issues
    const [yearStr, monthStr, dayStr] = entry.date.split("-");
    const entryDate = new Date(
      Number(yearStr),
      Number(monthStr) - 1,
      Number(dayStr),
    );
    const entryDoy = dayOfYear(entryDate);

    if (!isWithinWindow(entryDoy, targetDoy, windowDays)) {
      continue;
    }

    const moisture = resolveRootZoneMoisture(entry.layers, "archive", depthCm);
    if (moisture != null) {
      // Convert volumetric fraction to percentage
      windowValues.push(moisture * 100);
    }
  }

  if (windowValues.length < MIN_DATA_POINTS) {
    return null;
  }

  // Sort ascending for median and percentile calculations
  windowValues.sort((a, b) => a - b);

  const historicalMedianPct = roundTo(median(windowValues), 1);
  const departurePct = roundTo(historicalMedianPct - currentMoisturePct, 1);

  // Percentile rank: what % of historical values is the current value >= ?
  // A low percentile rank means current is drier than most historical values.
  const pctRank = roundTo(percentileRankOf(currentMoisturePct, windowValues), 0);

  // "Drier than X% of years" = 100 - percentile rank
  const drierThanPct = roundTo(100 - pctRank, 0);

  // Determine description
  const timeLabel = describeTimeOfYear(targetDate);
  let description: string;

  if (drierThanPct >= 60) {
    description = `Drier than ${drierThanPct}% of years for ${timeLabel}`;
  } else if (drierThanPct <= 40) {
    const wetterThanPct = roundTo(100 - drierThanPct, 0);
    description = `Wetter than ${wetterThanPct}% of years for ${timeLabel}`;
  } else {
    description = `Within normal range for ${timeLabel}`;
  }

  // Compute year span for the dateRange label
  const years = new Set<number>();
  for (const entry of historicalData.dailyValues) {
    const year = Number(entry.date.split("-")[0]);
    years.add(year);
  }
  const yearSpan = years.size;
  const dateRange = `${yearSpan}-year average`;

  return {
    currentPct: roundTo(currentMoisturePct, 1),
    historicalMedianPct,
    departurePct,
    percentileRank: drierThanPct,
    description,
    dateRange,
    dayOfYearWindow: windowDays,
  };
}
