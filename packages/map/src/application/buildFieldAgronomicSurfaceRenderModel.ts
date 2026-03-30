import { DEFAULT_MAP_EXTRUSION_MATERIAL } from "../contracts/material";
import { resolveRampColor } from "../contracts/colorRamp";
import type {
  FieldAgronomicCellRenderModel,
  CellSourceTier,
  FieldAgronomicSurfaceMetricKey,
  FieldAgronomicSurfaceRenderModel,
  CellVarianceBucket,
  CellSeverityLabel,
} from "../domain/render/FieldAgronomicSurfaceRenderModel";
import type {
  FieldBoundaryFeature,
  MapBoundingBox,
  MapGeoPoint,
  MapRgbColor,
  MapRgbaColor,
} from "../domain/render/FieldBoundaryPreviewRenderModel";
import { buildSyntheticFieldCellGrid } from "../domain/geometry/buildSyntheticFieldCellGrid";
import { normalizeExtrusionHeightSpread } from "./normalizeExtrusionHeightSpread";
import { resolveFieldRelativeCellAnalytics } from "./resolveFieldRelativeCellAnalytics";

type BuildFieldAgronomicSurfaceRenderModelInput = {
  fieldId: string;
  boundaryFeature: FieldBoundaryFeature;
  bbox: MapBoundingBox;
  metricKey: FieldAgronomicSurfaceMetricKey;
  /** Field-average metric value (0–100 for pct metrics, 0–100 normalized for indices). */
  baseValuePct: number;
  confidence: "low" | "medium" | "high";
  sourceLabel: string;
  persistedCells?: readonly {
    cellKey: string;
    centroid: MapGeoPoint;
    boundary: {
      type: "Polygon";
      coordinates: readonly (readonly MapGeoPoint[])[];
    };
    measurements: Readonly<Record<string, number>>;
    sourceKey: string;
  }[];
};

function isPreseasonOpticalContext(sourceLabel: string): boolean {
  return sourceLabel.toLowerCase().includes("preseason-optical-context");
}

// ── Shared utilities ────────────────────────────────────────

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * Boost saturation of an RGB color.
 *
 * Pushes each channel away from the luminance midpoint,
 * preventing the muddy mid-tones that linear RGB interpolation
 * creates between complementary hues (red→green = brown).
 */
function boostSaturation(
  [r, g, b]: MapRgbColor,
  factor: number,
): MapRgbColor {
  // Perceptual luminance
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return [
    clamp(Math.round(lum + (r - lum) * factor), 0, 255),
    clamp(Math.round(lum + (g - lum) * factor), 0, 255),
    clamp(Math.round(lum + (b - lum) * factor), 0, 255),
  ];
}

function mixColor(
  [ar, ag, ab]: MapRgbColor,
  [br, bg, bb]: MapRgbColor,
  weight: number,
): MapRgbColor {
  const clamped = clamp(weight, 0, 1);
  return [
    Math.round(ar + (br - ar) * clamped),
    Math.round(ag + (bg - ag) * clamped),
    Math.round(ab + (bb - ab) * clamped),
  ];
}

function withAlpha([red, green, blue]: MapRgbColor, alpha: number): MapRgbaColor {
  return [red, green, blue, alpha];
}

/** Edge colour: darkened tint of the cell fill so edges blend naturally. */
function darkenForEdge([r, g, b]: MapRgbColor, alpha: number): MapRgbaColor {
  return [
    Math.round(r * 0.45),
    Math.round(g * 0.45),
    Math.round(b * 0.45),
    alpha,
  ];
}

// ── Height model ────────────────────────────────────────────
const AGRONOMIC_BAND_BY_METRIC: Record<
  Exclude<FieldAgronomicSurfaceMetricKey, "root-zone-moisture-pct" | "surface-moisture-pct">,
  { adequateLowPct: number; adequateHighPct: number; oversupplyAlertPct?: number }
> = {
  ndvi: {
    adequateLowPct: 58,
    adequateHighPct: 82,
  },
  ndre: {
    adequateLowPct: 54,
    adequateHighPct: 78,
  },
  ndmi: {
    adequateLowPct: 62,
    adequateHighPct: 78,
    oversupplyAlertPct: 88,
  },
  "radar-wetness": {
    adequateLowPct: 16,
    adequateHighPct: 32,
    oversupplyAlertPct: 48,
  },
};

const BASE_AGRONOMIC_HEIGHT_M = 12;

// ── Spatial variation (synthetic mode) ──────────────────────

/**
 * Generates per-cell variation around the field-average base value.
 *
 * The goal is dramatic, visible color differences across the field —
 * some cells should be clearly stressed (brown/red), others clearly
 * healthy (deep green/blue). This uses multiple noise-like patterns:
 *
 *   - wave: sinusoidal pattern across the diagonal
 *   - drift: linear gradient NW-to-SE (simulates drainage slope)
 *   - pocket: localized depression (simulates a wet pocket)
 *   - jitter: per-cell pseudo-random noise from centroid coords
 */
function resolveSyntheticCellValue(
  baseValuePct: number,
  centroid: MapGeoPoint,
  normalizedX: number,
  normalizedY: number,
): number {
  const wave = Math.sin((normalizedX + normalizedY) * Math.PI * 3.0) * 14;
  const drift = (normalizedX - 0.5) * 28 + (0.5 - normalizedY) * 18;
  const pocket =
    Math.exp(-((normalizedX - 0.3) ** 2 + (normalizedY - 0.7) ** 2) * 12) * 30;
  const jitter = Math.sin(centroid[0] * 1000) * Math.cos(centroid[1] * 1000) * 8;

  return clamp(baseValuePct + wave + drift - pocket + jitter, 2, 98);
}

// ── Material per confidence ─────────────────────────────────

function resolveMaterial(
  confidence: "low" | "medium" | "high",
) {
  if (confidence === "high") {
    return {
      ...DEFAULT_MAP_EXTRUSION_MATERIAL,
      ambient: 0.42,
      diffuse: 1.0,
      shininess: 32,
    };
  }

  if (confidence === "medium") {
    return { ...DEFAULT_MAP_EXTRUSION_MATERIAL };
  }

  // Low confidence — slightly less reflective
  return {
    ...DEFAULT_MAP_EXTRUSION_MATERIAL,
    ambient: 0.35,
    diffuse: 0.92,
    shininess: 22,
  };
}

// ── Analytics helpers ──────────────────────────────────────

const CONFIDENCE_MAP: Record<string, number> = {
  high: 0.92,
  medium: 0.65,
  low: 0.35,
};

function classifyVariance(absDelta: number): CellVarianceBucket {
  if (absDelta > 15) return "high";
  if (absDelta > 6) return "medium";
  return "low";
}

function classifySeverity(
  metricKey: FieldAgronomicSurfaceMetricKey,
  valuePct: number,
): CellSeverityLabel {
  if (metricKey === "ndmi") {
    if (valuePct < 54) return "critical";
    if (valuePct < 62) return "stressed";
    if (valuePct > 92) return "critical";
    if (valuePct > 84) return "stressed";
    return "healthy";
  }

  if (metricKey === "radar-wetness") {
    if (valuePct < 10) return "critical";
    if (valuePct < 16) return "stressed";
    if (valuePct > 64) return "critical";
    if (valuePct > 48) return "stressed";
    return "healthy";
  }

  if (valuePct < 25) return "critical";
  if (valuePct < 45) return "stressed";
  return "healthy";
}

function resolveSourceTier(sourceKey: string | null | undefined): CellSourceTier {
  const normalizedKey = sourceKey?.toLowerCase() ?? "";

  if (normalizedKey.length === 0) {
    return "model-only";
  }

  if (
    normalizedKey.includes("synthetic-raster-grid-v1") ||
    normalizedKey.includes("planet-raster-grid-v1") ||
    normalizedKey.includes("synthetic")
  ) {
    return "synthetic";
  }

  if (normalizedKey.includes("stale-sar")) {
    return "stale-sar";
  }

  if (
    normalizedKey.includes("sentinel-1") ||
    normalizedKey.includes("sar")
  ) {
    return "fresh-sar";
  }

  if (normalizedKey.includes("sentinel-stale")) {
    return "sentinel-stale";
  }

  if (
    normalizedKey.includes("sentinel-2") ||
    normalizedKey.includes("sentinel-hub") ||
    normalizedKey.includes("planet-orders-cog-v1") ||
    normalizedKey.includes("planet")
  ) {
    return "sentinel-fresh";
  }

  return "model-only";
}

function resolveSourceScale(sourceTier: CellSourceTier): number {
  if (sourceTier === "synthetic") {
    return 0.82;
  }

  if (sourceTier === "model-only") {
    return 0.86;
  }

  if (sourceTier === "stale-sar" || sourceTier === "sentinel-stale") {
    return 0.92;
  }

  return 1;
}

function resolveFillAlpha(
  confidence: BuildFieldAgronomicSurfaceRenderModelInput["confidence"],
  sourceTier: CellSourceTier,
  preseasonOpticalContext: boolean,
): number {
  const base =
    confidence === "high" ? 248 : confidence === "medium" ? 228 : 196;

  const sourcePenalty =
    sourceTier === "synthetic"
      ? 42
      : sourceTier === "model-only"
        ? 52
        : sourceTier === "stale-sar" || sourceTier === "sentinel-stale"
          ? 24
          : 0;

  const contextPenalty = preseasonOpticalContext ? 22 : 0;

  return clamp(base - sourcePenalty - contextPenalty, 112, 255);
}

function resolveLineAlpha(fillAlpha: number): number {
  return clamp(Math.round(fillAlpha * 0.34), 42, 92);
}

function resolveAgronomicAttention(
  metricKey: Exclude<FieldAgronomicSurfaceMetricKey, "root-zone-moisture-pct" | "surface-moisture-pct">,
  valuePct: number,
  metricAveragePct: number,
): number {
  const band = AGRONOMIC_BAND_BY_METRIC[metricKey];
  const anomalyAttention = clamp(Math.abs(valuePct - metricAveragePct) / 10, 0, 0.45);
  const lowAverageBlend =
    metricKey === "ndvi" || metricKey === "ndre"
      ? clamp((band.adequateLowPct - metricAveragePct) / band.adequateLowPct, 0, 1)
      : 0;

  let absoluteAttention = 0;

  if (valuePct < band.adequateLowPct) {
    absoluteAttention = clamp(
      (band.adequateLowPct - valuePct) / band.adequateLowPct,
      0,
      1,
    );
  } else if (band.oversupplyAlertPct != null && valuePct > band.oversupplyAlertPct) {
    absoluteAttention = clamp(
      ((valuePct - band.oversupplyAlertPct) / (100 - band.oversupplyAlertPct)) * 0.45,
      0,
      0.45,
    );
  } else if (valuePct > band.adequateHighPct) {
    absoluteAttention = clamp(
      ((valuePct - band.adequateHighPct) / (100 - band.adequateHighPct)) * 0.2,
      0,
      0.2,
    );
  }

  if (lowAverageBlend <= 0) {
    return absoluteAttention;
  }

  return clamp(
    absoluteAttention * (1 - lowAverageBlend) * 0.25 +
      anomalyAttention * (0.25 + lowAverageBlend * 0.75),
    0,
    0.55,
  );
}

function resolveAgronomicColor(
  metricKey: FieldAgronomicSurfaceMetricKey,
  valuePct: number,
  metricAveragePct: number,
  deltaFromAveragePct: number,
  preseasonOpticalContext: boolean,
): MapRgbColor {
  const baseColor = resolveRampColor(metricKey, valuePct);
  const lowAverageBlend =
    metricKey === "ndvi" || metricKey === "ndre"
      ? clamp(
          (
            AGRONOMIC_BAND_BY_METRIC[metricKey].adequateLowPct - metricAveragePct
          ) / AGRONOMIC_BAND_BY_METRIC[metricKey].adequateLowPct,
          0,
          1,
        )
      : 0;

  if (lowAverageBlend <= 0) {
    if (!preseasonOpticalContext) {
      return boostSaturation(baseColor, 1.05);
    }

    return mixColor(boostSaturation(baseColor, 0.92), [126, 118, 98], 0.18);
  }

  const deltaWeight = clamp(Math.abs(deltaFromAveragePct) / 3.5, 0, 1);
  const positiveTarget: MapRgbColor =
    metricKey === "ndre" ? [176, 162, 104] : [194, 170, 104];
  const negativeTarget: MapRgbColor = [88, 68, 52];
  const contrastTarget =
    deltaFromAveragePct >= 0 ? positiveTarget : negativeTarget;
  const contrastWeight =
    deltaWeight * (0.18 + lowAverageBlend * 0.32);
  const contrasted = mixColor(baseColor, contrastTarget, contrastWeight);

  const saturated = boostSaturation(
    contrasted,
    preseasonOpticalContext
      ? 0.9 + (1 - lowAverageBlend) * 0.02
      : 1 + (1 - lowAverageBlend) * 0.05,
  );

  return preseasonOpticalContext
    ? mixColor(saturated, [122, 112, 92], 0.16 + lowAverageBlend * 0.08)
    : saturated;
}

function resolveDisplayHeightM(
  metricKey: FieldAgronomicSurfaceMetricKey,
  valuePct: number,
  metricAveragePct: number,
  deltaFromAveragePct: number,
  varianceBucket: CellVarianceBucket,
  sourceTier: CellSourceTier,
  preseasonOpticalContext: boolean,
): number {
  if (
    metricKey === "root-zone-moisture-pct" ||
    metricKey === "surface-moisture-pct"
  ) {
    const anomalyBoost = clamp(Math.abs(deltaFromAveragePct) / 100, 0, 0.5) * 16;
    const varianceBoost = varianceBucket === "high" ? 6 : varianceBucket === "medium" ? 3 : 0;
    const sourceScale = resolveSourceScale(sourceTier);

    return clamp(
      (BASE_AGRONOMIC_HEIGHT_M + anomalyBoost + varianceBoost) * sourceScale,
      6,
      72,
    );
  }

  const attention = resolveAgronomicAttention(metricKey, valuePct, metricAveragePct);
  const anomalyBoost =
    clamp(Math.abs(deltaFromAveragePct) / 100, 0, 0.5) *
    (preseasonOpticalContext ? 10 : 16);
  const varianceBoost = varianceBucket === "high" ? 6 : varianceBucket === "medium" ? 3 : 0;
  const sourceScale =
    resolveSourceScale(sourceTier) * (preseasonOpticalContext ? 0.82 : 1);

  return clamp(
    (
      BASE_AGRONOMIC_HEIGHT_M +
      attention * (preseasonOpticalContext ? 22 : 34) +
      anomalyBoost +
      varianceBoost
    ) * sourceScale,
    6,
    72,
  );
}

function resolveSoftMinHeightRangeM(metricKey: FieldAgronomicSurfaceMetricKey): number {
  if (
    metricKey === "root-zone-moisture-pct" ||
    metricKey === "surface-moisture-pct"
  ) {
    return 4;
  }

  if (metricKey === "ndmi") {
    return 4.5;
  }

  if (metricKey === "radar-wetness") {
    return 4.5;
  }

  return 5;
}

function resolveMeasurementKey(
  metricKey: FieldAgronomicSurfaceMetricKey,
): string | null {
  switch (metricKey) {
    case "ndvi":
      return "ndvi";
    case "ndre":
      return "ndre";
    case "ndmi":
      return "ndmi";
    case "radar-wetness":
      return "sarWetness";
    default:
      return null;
  }
}

function resolvePersistedCellValue(
  metricKey: FieldAgronomicSurfaceMetricKey,
  measurements: Readonly<Record<string, number>>,
): number | null {
  const measurementKey = resolveMeasurementKey(metricKey);

  if (!measurementKey) {
    return null;
  }

  const rawValue =
    measurements[measurementKey];

  if (!Number.isFinite(rawValue)) {
    return null;
  }

  return clamp(rawValue * 100, 0, 100);
}

// ── Builder ─────────────────────────────────────────────────

export function buildFieldAgronomicSurfaceRenderModel({
  fieldId,
  boundaryFeature,
  bbox,
  metricKey,
  baseValuePct,
  confidence,
  sourceLabel,
  persistedCells = [],
}: BuildFieldAgronomicSurfaceRenderModelInput): FieldAgronomicSurfaceRenderModel {
  const numericConfidence = CONFIDENCE_MAP[confidence] ?? 0.5;
  const preseasonOpticalContext = isPreseasonOpticalContext(sourceLabel);

  // ── Pass 1: compute cell values ──
  const persistedRawCells = persistedCells
    .map((cell) => {
      const cellValue = resolvePersistedCellValue(metricKey, cell.measurements);

      if (cellValue == null) {
        return null;
      }

      return {
        id: cell.cellKey,
        centroid: cell.centroid,
        polygon: cell.boundary.coordinates[0].map(
          ([longitude, latitude]) => [longitude, latitude] as MapGeoPoint,
        ),
        cellValue,
        sourceTier: resolveSourceTier(cell.sourceKey),
      };
    })
    .filter((cell): cell is NonNullable<typeof cell> => cell != null);

  const rawCells =
    persistedRawCells.length > 0
      ? persistedRawCells
      : buildSyntheticFieldCellGrid({
          fieldId,
          boundary: boundaryFeature.geometry,
          bbox,
          targetCellCount: 36,
        }).map((cell) => {
          const cellValue = resolveSyntheticCellValue(
            baseValuePct,
            cell.centroid,
            cell.normalizedX,
            cell.normalizedY,
          );
          return {
            id: cell.id,
            centroid: cell.centroid,
            polygon: cell.polygon,
            cellValue,
            sourceTier: "synthetic" as const,
          };
        });

  const metricAveragePct =
    rawCells.length > 0
      ? rawCells.reduce((sum, c) => sum + c.cellValue, 0) / rawCells.length
      : baseValuePct;
  const fieldRelativeAnalytics = resolveFieldRelativeCellAnalytics(
    rawCells.map((cell) => cell.cellValue),
  );

  // ── Pass 2: build render models with analytics ──
  const draftCells: FieldAgronomicCellRenderModel[] = rawCells.map((cell, index) => {
    const delta = cell.cellValue - metricAveragePct;
    const absDelta = Math.abs(delta);
    const vBucket = classifyVariance(absDelta);
    const fillAlpha = resolveFillAlpha(
      confidence,
      cell.sourceTier,
      preseasonOpticalContext,
    );
    const lineAlpha = resolveLineAlpha(fillAlpha);
    const enrichedHeight = resolveDisplayHeightM(
      metricKey,
      cell.cellValue,
      metricAveragePct,
      delta,
      vBucket,
      cell.sourceTier,
      preseasonOpticalContext,
    );
    const color = resolveAgronomicColor(
      metricKey,
      cell.cellValue,
      metricAveragePct,
      delta,
      preseasonOpticalContext,
    );
    const relativeAnalytics = fieldRelativeAnalytics[index] ?? {
      percentileInField: 50,
      anomalyClass: "near-field" as const,
    };

    return {
      id: cell.id,
      centroid: cell.centroid,
      polygon: cell.polygon,
      metricValuePct: cell.cellValue,
      displayHeightM: enrichedHeight,
      fillColor: withAlpha(color, fillAlpha),
      lineColor: darkenForEdge(color, lineAlpha),

      // Analytics payload
      confidence: numericConfidence,
      sourceTier: cell.sourceTier,
      varianceBucket: vBucket,
      deltaFromFieldAvgPct: Math.round(delta * 10) / 10,
      percentileInField: relativeAnalytics.percentileInField,
      anomalyClass: relativeAnalytics.anomalyClass,
      zoneId: null,
      severityLabel: classifySeverity(metricKey, cell.cellValue),
    };
  });

  const normalizedHeights = normalizeExtrusionHeightSpread(
    draftCells.map((cell) => cell.displayHeightM),
    {
      softMinRangeM: resolveSoftMinHeightRangeM(metricKey),
      maxBlend: 0.4,
      minHeightM: 6,
      maxHeightM: 72,
    },
  );

  const cells: FieldAgronomicCellRenderModel[] = draftCells.map((cell, index) => ({
    ...cell,
    displayHeightM: normalizedHeights[index] ?? cell.displayHeightM,
  }));

  return {
    id: `field-agronomic-surface:${metricKey}:${fieldId}`,
    kind: "field-agronomic-cell-surface",
    metricKey,
    metricAveragePct,
    confidence,
    sourceLabel,
    baseElevationM: 0,
    material: resolveMaterial(confidence),
    cells,
  };
}
