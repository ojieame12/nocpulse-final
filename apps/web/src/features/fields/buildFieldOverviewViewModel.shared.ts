import type { FieldRasterObservation } from "@fieldpulse/module-imagery";
import type { SidebarFieldItem } from "../../components/layout/Sidebar";

export function isStabilityDebugEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.FIELDPULSE_DEBUG_PERF === "1";
}

export function estimateJsonSize(value: unknown): number {
  try {
    return JSON.stringify(value)?.length ?? 0;
  } catch {
    return 0;
  }
}

export function startPerfTimer(enabled: boolean) {
  return enabled ? performance.now() : 0;
}

export function finishPerfTimer(startedAt: number, enabled: boolean) {
  if (!enabled) {
    return 0;
  }

  return Math.round((performance.now() - startedAt) * 100) / 100;
}

export function deriveSidebarStatus(input: {
  rootZonePct?: number | null;
  confidence?: "low" | "medium" | "high" | null;
  activeAlertCount?: number | null;
}): SidebarFieldItem["status"] {
  if ((input.activeAlertCount ?? 0) > 0) {
    return input.activeAlertCount && input.activeAlertCount > 1
      ? "stressed"
      : "warning";
  }
  if (input.rootZonePct == null) {
    return "pending";
  }
  if (input.rootZonePct < 25) {
    return "stressed";
  }
  if (input.rootZonePct < 35 || input.confidence === "low") {
    return "warning";
  }
  return "healthy";
}

export function extractTrackedZoneIds(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const trackedZones = (value as { trackedZones?: unknown }).trackedZones;
  if (!Array.isArray(trackedZones)) return [];
  return trackedZones
    .map((entry) =>
      entry && typeof entry === "object" && "zoneId" in entry
        ? (entry as { zoneId?: unknown }).zoneId
        : null,
    )
    .filter((zoneId): zoneId is string => typeof zoneId === "string");
}

export function averageNumbers(values: readonly number[]) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function minNumber(values: readonly number[]) {
  return values.length === 0 ? null : Math.min(...values);
}

export function maxNumber(values: readonly number[]) {
  return values.length === 0 ? null : Math.max(...values);
}

export function toTimestampMillis(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function chooseLatestObservation(
  observations: readonly (FieldRasterObservation | null | undefined)[],
) {
  return observations
    .filter((observation): observation is FieldRasterObservation => observation != null)
    .sort((left, right) => {
      const observedAtDelta =
        toTimestampMillis(right.observedAt) - toTimestampMillis(left.observedAt);
      if (observedAtDelta !== 0) {
        return observedAtDelta;
      }

      return toTimestampMillis(right.createdAt) - toTimestampMillis(left.createdAt);
    })[0] ?? null;
}

export function toEarlierTimestamp(value: string | null | undefined) {
  if (!value) {
    return undefined;
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return new Date(parsed - 1).toISOString();
}

export function formatSignedPercentDelta(value: number | null) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  if (value === 0) {
    return "0.0%";
  }

  const sign = value > 0 ? "+" : "−";
  return `${sign}${Math.abs(value).toFixed(1)}%`;
}

export function formatMediumDateTime(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatHistoryLabel(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function buildObservationHistoryLabels(
  observations: readonly FieldRasterObservation[],
) {
  const shortDateLabels = observations.map((observation) =>
    formatHistoryLabel(observation.observedAt),
  );
  const duplicateDates = new Set<string>();

  for (const label of shortDateLabels) {
    if (shortDateLabels.filter((entry) => entry === label).length > 1) {
      duplicateDates.add(label);
    }
  }

  return observations.map((observation, index) => {
    const baseLabel = shortDateLabels[index] ?? "—";
    if (!duplicateDates.has(baseLabel)) {
      return baseLabel;
    }

    return new Date(observation.observedAt).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  });
}

export function toCapturePercentLabel(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  return `${value.toFixed(1)}%`;
}

export function shortProviderLabel(value: string | null | undefined) {
  if (!value) {
    return "raster";
  }

  switch (value) {
    case "sentinel-1":
      return "SAR";
    case "sentinel-2":
      return "optical";
    case "planet":
      return "Planet";
    default:
      return value;
  }
}

/** Compact source tag for inline provenance hints (even shorter than shortProviderLabel). */
export function shortProviderTag(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  switch (value) {
    case "sentinel-1":      return "SAR";
    case "sentinel-2":      return "Optical";
    case "planet":           return "Planet";
    case "open-meteo":       return "Weather";
    case "synthetic-raster-grid-v1":
    case "synthetic":        return "Synthetic";
    default:
      // Strip common prefixes for unknown keys — e.g. "era5-land" → "ERA5"
      if (value.startsWith("era5")) return "ERA5";
      if (value.startsWith("synthetic")) return "Synthetic";
      // Capitalise first word for anything else
      return value.split("-")[0].charAt(0).toUpperCase() + value.split("-")[0].slice(1);
  }
}

export function toPrimitiveMetadata(
  value: unknown,
): Readonly<Record<string, string | number | boolean | null>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  const metadata: Record<string, string | number | boolean | null> = {};
  for (const [key, entryValue] of Object.entries(value)) {
    if (
      typeof entryValue === "string" ||
      typeof entryValue === "number" ||
      typeof entryValue === "boolean" ||
      entryValue === null
    ) {
      metadata[key] = entryValue;
    }
  }

  return Object.freeze(metadata);
}

/**
 * Resolve pre-computed historical anomaly fields from the read model into the
 * summary-props shape. Returns `null` when the read model has no anomaly data.
 */
export function resolveHistoricalAnomalyFromReadModel(readModel: {
  historicalAnomalyPercentile?: number | null;
  historicalAnomalyDescription?: string | null;
}): {
  percentile: number;
  description: string;
  anomalyClass: 'unusually-dry' | 'normal' | 'unusually-wet';
} | null {
  const description = readModel.historicalAnomalyDescription?.trim() ?? "";

  if (readModel.historicalAnomalyPercentile == null || description.length === 0) {
    return null;
  }

  return {
    percentile: readModel.historicalAnomalyPercentile,
    description,
    anomalyClass:
      readModel.historicalAnomalyPercentile > 75
        ? 'unusually-dry'
        : readModel.historicalAnomalyPercentile < 25
          ? 'unusually-wet'
          : 'normal',
  };
}
