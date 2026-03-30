import { DEFAULT_MAP_EXTRUSION_MATERIAL } from "../contracts/material";
import { resolveRampColor } from "../contracts/colorRamp";
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
import { normalizeExtrusionHeightSpread } from "./normalizeExtrusionHeightSpread";
import { resolveFieldRelativeCellAnalytics } from "./resolveFieldRelativeCellAnalytics";

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

const ADEQUATE_MOISTURE_LOW_PCT = 38;
const ADEQUATE_MOISTURE_HIGH_PCT = 62;
const SATURATION_ALERT_PCT = 84;
const BASE_MOISTURE_HEIGHT_M = 12;

function resolveMoistureStressAttention(
  rootZonePct: number,
  surfacePct: number,
): number {
  const blended = rootZonePct * 0.78 + surfacePct * 0.22;

  if (blended < ADEQUATE_MOISTURE_LOW_PCT) {
    return clamp(
      (ADEQUATE_MOISTURE_LOW_PCT - blended) / ADEQUATE_MOISTURE_LOW_PCT,
      0,
      1,
    );
  }

  if (blended > SATURATION_ALERT_PCT) {
    return clamp(
      ((blended - SATURATION_ALERT_PCT) / (100 - SATURATION_ALERT_PCT)) * 0.7,
      0,
      0.7,
    );
  }

  if (blended > ADEQUATE_MOISTURE_HIGH_PCT) {
    return clamp(
      ((blended - ADEQUATE_MOISTURE_HIGH_PCT) /
        (SATURATION_ALERT_PCT - ADEQUATE_MOISTURE_HIGH_PCT)) *
        0.35,
      0,
      0.35,
    );
  }

  return 0;
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
  if (valuePct < 35 || valuePct > 85) return "stressed";
  return "healthy";
}

function resolveSourceTier(sourceKey: string | null | undefined): CellSourceTier {
  const normalizedKey = sourceKey?.toLowerCase() ?? "";

  if (normalizedKey.length === 0) {
    return "model-only";
  }

  if (
    normalizedKey.includes("synthetic-grid") ||
    normalizedKey.includes("synthetic-raster-grid") ||
    normalizedKey.includes("imagery-observation-synthetic-v1") ||
    normalizedKey.includes("imagery-synthetic-raster-observation-v1") ||
    normalizedKey.includes("planet-raster-grid-v1") ||
    normalizedKey.includes("synthetic-preview")
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
  confidence: BuildFieldMoistureSurfaceRenderModelInput["confidence"],
  sourceTier: CellSourceTier,
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

  return clamp(base - sourcePenalty, 128, 255);
}

function resolveLineAlpha(fillAlpha: number): number {
  return clamp(Math.round(fillAlpha * 0.34), 42, 92);
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
  const numericConfidence = CONFIDENCE_MAP[confidence] ?? 0.5;

  // ── Pass 1: compute raw cell values ──
  type RawCell = {
    id: string;
    centroid: MapGeoPoint;
    polygon: MapGeoPoint[];
    metricValuePct: number;
    surfacePct: number;
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
          surfacePct: cell.surfacePct,
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
            surfacePct: cellSurfacePct,
            sourceTier: "synthetic",
          };
        });

  const metricAveragePct =
    rawCells.length > 0
      ? rawCells.reduce((sum, c) => sum + c.metricValuePct, 0) / rawCells.length
      : rootZonePct;
  const fieldRelativeAnalytics = resolveFieldRelativeCellAnalytics(
    rawCells.map((cell) => cell.metricValuePct),
  );

  // ── Pass 2: build render models with analytics ──
  const draftCells: FieldAgronomicCellRenderModel[] = rawCells.map((cell, index) => {
    const color = resolveRampColor("root-zone-moisture-pct", cell.metricValuePct);
    const delta = cell.metricValuePct - metricAveragePct;
    const absDelta = Math.abs(delta);
    const vBucket = classifyVariance(absDelta);
    const stressAttention = resolveMoistureStressAttention(
      cell.metricValuePct,
      cell.surfacePct,
    );
    const anomalyAttention = clamp(absDelta / 18, 0, 1);
    const varianceBoost = vBucket === "high" ? 6 : vBucket === "medium" ? 3 : 0;
    const sourceScale = resolveSourceScale(cell.sourceTier);
    const attentionHeight = BASE_MOISTURE_HEIGHT_M +
      stressAttention * 28 +
      anomalyAttention * 12 +
      varianceBoost;
    const enrichedHeight = clamp(
      attentionHeight * sourceScale,
      8,
      64,
    );
    const fillAlpha = resolveFillAlpha(confidence, cell.sourceTier);
    const lineAlpha = resolveLineAlpha(fillAlpha);
    const relativeAnalytics = fieldRelativeAnalytics[index] ?? {
      percentileInField: 50,
      anomalyClass: "near-field" as const,
    };

    return {
      id: cell.id,
      centroid: cell.centroid,
      polygon: cell.polygon,
      metricValuePct: cell.metricValuePct,
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
      severityLabel: classifySeverity(cell.metricValuePct),
    };
  });

  const normalizedHeights = normalizeExtrusionHeightSpread(
    draftCells.map((cell) => cell.displayHeightM),
    {
      softMinRangeM: 4,
      maxBlend: 0.35,
      minHeightM: 8,
      maxHeightM: 64,
    },
  );

  const cells: FieldAgronomicCellRenderModel[] = draftCells.map((cell, index) => ({
    ...cell,
    displayHeightM: normalizedHeights[index] ?? cell.displayHeightM,
  }));

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
