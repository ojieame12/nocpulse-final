import { DEFAULT_MAP_EXTRUSION_MATERIAL } from "../contracts/material";
import { resolveColorRamp, type ColorRamp } from "../contracts/colorRamp";
import type {
  FieldAgronomicCellRenderModel,
  FieldAgronomicSurfaceRenderModel,
  CellSourceTier,
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

type BuildFieldMoistureSurfaceRenderModelInput = {
  fieldId: string;
  boundaryFeature: FieldBoundaryFeature;
  bbox: MapBoundingBox;
  rootZonePct: number;
  surfacePct: number;
  confidence: "low" | "medium" | "high";
  sourceLabel: string;
  persistedCells?: readonly {
    cellKey: string;
    centroid: MapGeoPoint;
    boundary: {
      type: "Polygon";
      coordinates: readonly (readonly MapGeoPoint[])[];
    };
    rootZonePct: number;
    surfacePct: number;
    sourceKey: string;
  }[];
};

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

      const midness = 1 - Math.abs(weight - 0.5) * 2;
      const boost = 1 + midness * 0.35;
      return boostSaturation(raw, boost);
    }
  }

  return [...stops[stops.length - 1][1]];
}

function withAlpha([red, green, blue]: MapRgbColor, alpha: number): MapRgbaColor {
  return [red, green, blue, alpha];
}

function resolveDisplayHeightM(rootZonePct: number, surfacePct: number): number {
  const blended = rootZonePct * 0.7 + surfacePct * 0.3;
  // Wide range so metric value is the dominant visual factor.
  // 0% → 4m (stubby), 50% → 34m, 100% → 64m.
  return clamp(4 + blended * 0.6, 4, 64);
}

function resolveCellMoistureValue(
  baseValuePct: number,
  centroid: MapGeoPoint,
  normalizedX: number,
  normalizedY: number,
): number {
  const wave = Math.sin((normalizedX + normalizedY) * Math.PI * 2.2) * 10;
  const drift = (normalizedX - 0.5) * 24 + (0.5 - normalizedY) * 14;
  const geographicBias = Math.sin((centroid[0] + centroid[1]) * 25) * 4;

  return clamp(baseValuePct + wave + drift + geographicBias, 0, 100);
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

function classifySeverity(valuePct: number): CellSeverityLabel {
  if (valuePct < 18) return "critical";
  if (valuePct < 30) return "stressed";
  return "healthy";
}

function resolveSourceTier(sourceKey: string | null | undefined): CellSourceTier {
  const normalizedKey = sourceKey?.toLowerCase() ?? "";

  if (normalizedKey.length === 0) {
    return "model-only";
  }

  if (
    normalizedKey.includes("synthetic-grid-v1") ||
    normalizedKey.includes("synthetic-raster-grid-v1") ||
    normalizedKey.includes("imagery-observation-synthetic-v1") ||
    normalizedKey.includes("imagery-synthetic-raster-observation-v1") ||
    normalizedKey.includes("planet-raster-grid-v1")
  ) {
    return "synthetic";
  }

  if (normalizedKey.includes("twi")) {
    return "twi-prior";
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
    normalizedKey.includes("imagery-persisted-raster-observation-v1")
  ) {
    return "sentinel-fresh";
  }

  if (
    normalizedKey.includes("worker.rebuild-field-estimate") ||
    normalizedKey.includes("model-only")
  ) {
    return "model-only";
  }

  return "model-only";
}

function resolveMaterial(
  confidence: BuildFieldMoistureSurfaceRenderModelInput["confidence"],
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

  return {
    ...DEFAULT_MAP_EXTRUSION_MATERIAL,
    ambient: 0.35,
    diffuse: 0.92,
    shininess: 22,
  };
}

export function buildFieldMoistureSurfaceRenderModel({
  fieldId,
  boundaryFeature,
  bbox,
  rootZonePct,
  surfacePct,
  confidence,
  sourceLabel,
  persistedCells = [],
}: BuildFieldMoistureSurfaceRenderModelInput): FieldAgronomicSurfaceRenderModel {
  const ramp = resolveColorRamp("root-zone-moisture-pct");
  const numericConfidence = CONFIDENCE_MAP[confidence] ?? 0.5;

  // ── Pass 1: compute raw cell values ──
  type RawCell = {
    id: string;
    centroid: MapGeoPoint;
    polygon: MapGeoPoint[];
    metricValuePct: number;
    displayHeightM: number;
    sourceTier: CellSourceTier;
  };

  const rawCells: RawCell[] =
    persistedCells.length > 0
      ? persistedCells.map((cell) => ({
          id: cell.cellKey,
          centroid: [cell.centroid[0], cell.centroid[1]] as MapGeoPoint,
          polygon: cell.boundary.coordinates[0].map(
            ([longitude, latitude]) => [longitude, latitude] as MapGeoPoint,
          ),
          metricValuePct: cell.rootZonePct,
          displayHeightM: resolveDisplayHeightM(cell.rootZonePct, cell.surfacePct),
          sourceTier: resolveSourceTier(cell.sourceKey),
        }))
      : buildSyntheticFieldCellGrid({
          fieldId,
          boundary: boundaryFeature.geometry,
          bbox,
        }).map((cell) => {
          const cellRootZonePct = resolveCellMoistureValue(
            rootZonePct,
            cell.centroid,
            cell.normalizedX,
            cell.normalizedY,
          );
          const cellSurfacePct = resolveCellMoistureValue(
            surfacePct,
            cell.centroid,
            cell.normalizedY,
            cell.normalizedX,
          );
          return {
            id: cell.id,
            centroid: cell.centroid,
            polygon: cell.polygon,
            metricValuePct: cellRootZonePct,
            displayHeightM: resolveDisplayHeightM(cellRootZonePct, cellSurfacePct),
            sourceTier: "synthetic",
          };
        });

  const metricAveragePct =
    rawCells.length > 0
      ? rawCells.reduce((sum, c) => sum + c.metricValuePct, 0) / rawCells.length
      : rootZonePct;

  // ── Pass 2: build render models with analytics ──
  const cells: FieldAgronomicCellRenderModel[] = rawCells.map((cell) => {
    const color = interpolateColor(cell.metricValuePct, ramp);
    const delta = cell.metricValuePct - metricAveragePct;
    const absDelta = Math.abs(delta);
    const vBucket = classifyVariance(absDelta);

    // V1-style relief: base height + anomaly boost + variance boost.
    // Cells that deviate from the field avg or sit in high-variance zones
    // stand taller, making spatial patterns easier to read.
    const anomalyBoost = (absDelta / 100) * 14;
    const varianceBoost = vBucket === "high" ? 6 : vBucket === "medium" ? 3 : 0;
    const sourceScale = cell.sourceTier === "synthetic" ? 0.7 : 1.0;
    const enrichedHeight = clamp(
      (cell.displayHeightM + anomalyBoost + varianceBoost) * sourceScale,
      4,
      72,
    );

    return {
      id: cell.id,
      centroid: cell.centroid,
      polygon: cell.polygon,
      metricValuePct: cell.metricValuePct,
      displayHeightM: enrichedHeight,
      fillColor: withAlpha(color, 255),
      lineColor: withAlpha([18, 24, 18], 48),

      // Analytics payload
      confidence: numericConfidence,
      sourceTier: cell.sourceTier,
      varianceBucket: vBucket,
      deltaFromFieldAvgPct: Math.round(delta * 10) / 10,
      zoneId: null,
      severityLabel: classifySeverity(cell.metricValuePct),
    };
  });

  return {
    id: `field-moisture-surface:${fieldId}`,
    kind: "field-agronomic-cell-surface",
    metricKey: "root-zone-moisture-pct",
    metricAveragePct,
    confidence,
    sourceLabel,
    baseElevationM: 0,
    material: resolveMaterial(confidence),
    cells,
  };
}
