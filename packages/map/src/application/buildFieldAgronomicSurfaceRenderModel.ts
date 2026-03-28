import { DEFAULT_MAP_EXTRUSION_MATERIAL } from "../contracts/material";
import { resolveColorRamp, type ColorRamp } from "../contracts/colorRamp";
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

function interpolateColor(
  valuePct: number,
  stops: ColorRamp,
): MapRgbColor {
  const clamped = clamp(valuePct, 0, 100);

  for (let index = 0; index < stops.length - 1; index += 1) {
    const [startPct, startColor] = stops[index];
    const [endPct, endColor] = stops[index + 1];

    if (clamped <= endPct) {
      const range = endPct - startPct || 1;
      const weight = (clamped - startPct) / range;

      const raw: MapRgbColor = [
        Math.round(startColor[0] + (endColor[0] - startColor[0]) * weight),
        Math.round(startColor[1] + (endColor[1] - startColor[1]) * weight),
        Math.round(startColor[2] + (endColor[2] - startColor[2]) * weight),
      ];

      // Mid-blend weights (0.3–0.7) produce the muddiest tones;
      // boost saturation proportionally to how close we are to midpoint
      const midness = 1 - Math.abs(weight - 0.5) * 2; // 0 at edges, 1 at midpoint
      const boost = 1 + midness * 0.35; // up to 35% saturation lift at midpoint
      return boostSaturation(raw, boost);
    }
  }

  return [...stops[stops.length - 1][1]];
}

function withAlpha([red, green, blue]: MapRgbColor, alpha: number): MapRgbaColor {
  return [red, green, blue, alpha];
}

// ── Height model ────────────────────────────────────────────

/**
 * Extrusion height depends on metric type:
 *   - Vegetation indices: higher value = taller (healthy = prominent)
 *   - Moisture: blended root/surface, moderate range
 */
function resolveDisplayHeightM(
  metricKey: FieldAgronomicSurfaceMetricKey,
  valuePct: number,
): number {
  if (metricKey === "root-zone-moisture-pct" || metricKey === "surface-moisture-pct") {
    // Wide range: 0% → 4m (stubby), 50% → 34m, 100% → 64m.
    return clamp(4 + valuePct * 0.6, 4, 64);
  }

  // Vegetation indices: healthy canopy towers above stressed cells.
  // 0% → 4m, 50% → 36m, 100% → 68m.
  return clamp(4 + valuePct * 0.64, 4, 68);
}

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
  if (metricKey === "root-zone-moisture-pct" || metricKey === "surface-moisture-pct") {
    if (valuePct < 18) return "critical";
    if (valuePct < 30) return "stressed";
    return "healthy";
  }
  // Vegetation indices: low = stressed
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
    metricKey === "ndmi" && !Number.isFinite(measurements[measurementKey])
      ? measurements.sarWetness
      : measurements[measurementKey];

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
  const ramp = resolveColorRamp(metricKey);
  const numericConfidence = CONFIDENCE_MAP[confidence] ?? 0.5;

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

  // ── Pass 2: build render models with analytics ──
  const cells: FieldAgronomicCellRenderModel[] = rawCells.map((cell) => {
    const color = interpolateColor(cell.cellValue, ramp);
    const delta = cell.cellValue - metricAveragePct;
    const absDelta = Math.abs(delta);
    const vBucket = classifyVariance(absDelta);

    // V1-style relief: base + anomaly boost + variance boost.
    const baseHeight = resolveDisplayHeightM(metricKey, cell.cellValue);
    const anomalyBoost = (absDelta / 100) * 14;
    const varianceBoost = vBucket === "high" ? 6 : vBucket === "medium" ? 3 : 0;
    const sourceScale = cell.sourceTier === "synthetic" ? 0.7 : 1.0;
    const enrichedHeight = clamp(
      (baseHeight + anomalyBoost + varianceBoost) * sourceScale,
      4,
      72,
    );

    return {
      id: cell.id,
      centroid: cell.centroid,
      polygon: cell.polygon,
      metricValuePct: cell.cellValue,
      displayHeightM: enrichedHeight,
      fillColor: withAlpha(color, 255),
      lineColor: withAlpha([18, 24, 18], 48),

      // Analytics payload
      confidence: numericConfidence,
      sourceTier: cell.sourceTier,
      varianceBucket: vBucket,
      deltaFromFieldAvgPct: Math.round(delta * 10) / 10,
      zoneId: null,
      severityLabel: classifySeverity(metricKey, cell.cellValue),
    };
  });

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
