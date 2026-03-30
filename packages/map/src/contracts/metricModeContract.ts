import type {
  CellSourceTier,
  FieldAgronomicSurfaceMetricKey,
} from "../domain/render/FieldAgronomicSurfaceRenderModel";

export type MetricThresholdLabel = {
  pct: number;
  label: string;
};

export type MetricModeContract = {
  metricKey: FieldAgronomicSurfaceMetricKey;
  label: string;
  shortLabel: string;
  subtitle: string;
  rampStartLabel: string;
  rampEndLabel: string;
  valueMeaning: string;
  heightMeaning: string;
  thresholds: readonly MetricThresholdLabel[];
};

const MODE_CONTRACTS: Record<FieldAgronomicSurfaceMetricKey, MetricModeContract> = {
  "root-zone-moisture-pct": {
    metricKey: "root-zone-moisture-pct",
    label: "Moisture",
    shortLabel: "Moisture",
    subtitle: "Root-zone moisture",
    rampStartLabel: "Severe deficit",
    rampEndLabel: "Saturated",
    valueMeaning: "Color = measured root-zone moisture (%)",
    heightMeaning: "Height = moisture stress anomaly",
    thresholds: [
      { pct: 0, label: "Severe deficit" },
      { pct: 25, label: "Drying" },
      { pct: 50, label: "Adequate" },
      { pct: 75, label: "Recharge" },
      { pct: 100, label: "Saturated" },
    ],
  },
  "surface-moisture-pct": {
    metricKey: "surface-moisture-pct",
    label: "Surface Moisture",
    shortLabel: "Surface",
    subtitle: "Surface moisture",
    rampStartLabel: "Dry surface",
    rampEndLabel: "Wet surface",
    valueMeaning: "Color = estimated surface moisture (%)",
    heightMeaning: "Height = surface moisture anomaly",
    thresholds: [
      { pct: 0, label: "Dry surface" },
      { pct: 25, label: "Drying" },
      { pct: 50, label: "Balanced" },
      { pct: 75, label: "Recharge" },
      { pct: 100, label: "Wet surface" },
    ],
  },
  ndvi: {
    metricKey: "ndvi",
    label: "NDVI",
    shortLabel: "NDVI",
    subtitle: "Canopy vigor",
    rampStartLabel: "Bare / weak",
    rampEndLabel: "Peak vigor",
    valueMeaning: "Color = canopy vigor",
    heightMeaning: "Height = vigor attention score",
    thresholds: [
      { pct: 0, label: "Bare / weak" },
      { pct: 20, label: "Sparse" },
      { pct: 40, label: "Developing" },
      { pct: 60, label: "Healthy canopy" },
      { pct: 80, label: "Peak vigor" },
    ],
  },
  ndre: {
    metricKey: "ndre",
    label: "NDRE",
    shortLabel: "NDRE",
    subtitle: "Red-edge chlorophyll",
    rampStartLabel: "Low chlorophyll",
    rampEndLabel: "Strong red-edge",
    valueMeaning: "Color = chlorophyll / red-edge response",
    heightMeaning: "Height = chlorophyll stress signal",
    thresholds: [
      { pct: 0, label: "Low chlorophyll" },
      { pct: 20, label: "Early stress" },
      { pct: 40, label: "Moderate" },
      { pct: 60, label: "Healthy" },
      { pct: 80, label: "Strong red-edge" },
    ],
  },
  ndmi: {
    metricKey: "ndmi",
    label: "NDMI",
    shortLabel: "NDMI",
    subtitle: "Canopy water content",
    rampStartLabel: "Dry canopy",
    rampEndLabel: "Water-rich canopy",
    valueMeaning: "Color = canopy water content",
    heightMeaning: "Height = canopy drydown anomaly",
    thresholds: [
      { pct: 0, label: "Dry canopy" },
      { pct: 20, label: "Moisture stress" },
      { pct: 40, label: "Balanced" },
      { pct: 60, label: "Moist canopy" },
      { pct: 80, label: "Water-rich canopy" },
    ],
  },
  "radar-wetness": {
    metricKey: "radar-wetness",
    label: "Radar Wetness",
    shortLabel: "Radar",
    subtitle: "SAR wetness proxy",
    rampStartLabel: "Dry radar return",
    rampEndLabel: "Wet radar return",
    valueMeaning: "Color = SAR-derived wetness proxy",
    heightMeaning: "Height = radar wetness anomaly",
    thresholds: [
      { pct: 0, label: "Dry return" },
      { pct: 20, label: "Drying" },
      { pct: 40, label: "Mixed" },
      { pct: 60, label: "Wet return" },
      { pct: 80, label: "Strong wetness" },
    ],
  },
};

export function resolveMetricModeContract(
  metricKey: FieldAgronomicSurfaceMetricKey,
  sourceLabel?: string,
): MetricModeContract {
  if (isSarBackedNdmiSource(metricKey, sourceLabel)) {
    return MODE_CONTRACTS["radar-wetness"];
  }

  return MODE_CONTRACTS[metricKey];
}

export function formatMetricDisplayValue(
  metricKey: FieldAgronomicSurfaceMetricKey,
  pct: number | null | undefined,
): string {
  if (!Number.isFinite(pct)) {
    return "—";
  }

  if (
    metricKey === "root-zone-moisture-pct" ||
    metricKey === "surface-moisture-pct"
  ) {
    return `${pct!.toFixed(1)}%`;
  }

  return (pct! / 100).toFixed(2);
}

export function describeMetricSource(
  sourceLabel?: string,
  confidence?: "low" | "medium" | "high",
): string {
  const normalizedSource = normalizeMetricSourceLabel(sourceLabel);
  const normalizedConfidence = confidence?.trim();

  if (!normalizedSource && !normalizedConfidence) {
    return "No source context";
  }

  const parts: string[] = [];

  if (normalizedSource) {
    parts.push(normalizedSource);
  }

  if (normalizedConfidence) {
    parts.push(`${normalizedConfidence} confidence`);
  }

  return parts.join(" · ");
}

export function describeCellSourceTier(
  sourceTier: CellSourceTier,
  metricKey?: FieldAgronomicSurfaceMetricKey,
): string {
  switch (sourceTier) {
    case "fresh-sar":
      return metricKey === "ndmi" || metricKey === "radar-wetness"
        ? "SAR-backed radar-wetness surface"
        : "SAR-backed raster cell";
    case "stale-sar":
      return metricKey === "ndmi" || metricKey === "radar-wetness"
        ? "Stale SAR radar-wetness fallback"
        : "Stale SAR fallback";
    case "sentinel-fresh":
      return "Optical/provider-backed raster cell";
    case "sentinel-stale":
      return "Stale optical raster";
    case "synthetic":
      return "Synthetic fallback surface";
    case "model-only":
      return "Modeled estimate";
    case "twi-prior":
      return "Terrain-prior estimate";
    default:
      return sourceTier;
  }
}

function isSarBackedNdmiSource(
  metricKey: FieldAgronomicSurfaceMetricKey,
  sourceLabel?: string,
): boolean {
  if (metricKey !== "ndmi") {
    return false;
  }

  const normalized = sourceLabel?.trim().toLowerCase() ?? "";
  if (!normalized) {
    return false;
  }

  const optical =
    normalized.includes("sentinel-2") ||
    normalized.includes("planet") ||
    normalized.includes("optical");
  const sar =
    normalized.includes("sentinel-1") ||
    normalized.includes("fresh-sar") ||
    normalized.includes("stale-sar") ||
    normalized.includes("sar");

  return sar && !optical;
}

function normalizeMetricSourceLabel(sourceLabel?: string): string | null {
  const raw = sourceLabel?.trim();
  if (!raw) {
    return null;
  }

  const normalized = raw.toLowerCase();
  const isPreseasonOpticalContext =
    normalized.includes("preseason-optical-context");

  if (normalized.includes("synthetic-preview")) {
    return "Synthetic preview surface";
  }

  if (normalized.includes("synthetic-raster-grid")) {
    return "Synthetic raster fallback";
  }

  const parts: string[] = [];

  if (normalized.includes("imagery-raster-derived-v1")) {
    parts.push("Raster-derived moisture");
  }

  if (normalized.includes("sentinel-1")) {
    parts.push("Sentinel-1 SAR");
  } else if (normalized.includes("sentinel-2")) {
    parts.push("Sentinel-2 optical");
  } else if (normalized.includes("planet")) {
    parts.push("Planet optical");
  }

  if (parts.length > 0) {
    const deduped = Array.from(new Set(parts)).join(" · ");
    return isPreseasonOpticalContext
      ? `Preseason optical context · ${deduped}`
      : deduped;
  }

  return isPreseasonOpticalContext ? "Preseason optical context" : raw;
}
