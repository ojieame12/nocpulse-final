import type { MapExtrusionMaterial } from "../../contracts/material";
import type { MapGeoPoint, MapRgbaColor } from "./FieldBoundaryPreviewRenderModel";

export type FieldAgronomicSurfaceMetricKey =
  | "ndvi"
  | "ndre"
  | "ndmi"
  | "radar-wetness"
  | "root-zone-moisture-pct"
  | "surface-moisture-pct";

export type CellVarianceBucket = "low" | "medium" | "high";
export type CellSeverityLabel = "healthy" | "stressed" | "critical" | null;
export type CellAnomalyClass = "below-field" | "near-field" | "above-field";
export type CellSourceTier =
  | "fresh-sar"
  | "stale-sar"
  | "twi-prior"
  | "model-only"
  | "sentinel-fresh"
  | "sentinel-stale"
  | "synthetic";

/**
 * Field-level moisture provenance stamped onto each cell so interaction
 * events can surface data-quality context without a second lookup.
 * All fields are optional — omitted when the upstream snapshot does not
 * provide them (e.g. synthetic or preview surfaces).
 */
export type CellProvenanceContext = {
  /** Plant-available-water depletion 0–100 (field-level). */
  depletionPct?: number | null;
  /** Raster freshness factor 0–1 (1 = just acquired, 0 = fully stale). */
  freshnessFactor?: number | null;
  /** Hours since the most recent raster observation. */
  rasterAgeHours?: number | null;
  /** Multi-source agreement classification. */
  agreementFlag?: "agree" | "neutral" | "divergent" | null;
  /** Spatial resolution tier of the primary data source. */
  resolutionTier?: "sub-field" | "field-level" | "regional" | null;
  /** Available water in mm (field-level). */
  availableWaterMm?: number | null;
  /** Root-zone depth used for the estimate in cm. */
  rootZoneDepthCm?: number;
};

export type FieldAgronomicCellRenderModel = {
  id: string;
  centroid: MapGeoPoint;
  polygon: MapGeoPoint[];
  metricValuePct: number;
  displayHeightM: number;
  fillColor: MapRgbaColor;
  lineColor: MapRgbaColor;

  // ── Analytics payload ──
  /** Per-cell confidence 0–1. */
  confidence: number;
  /** Data source tier for this cell. */
  sourceTier: CellSourceTier;
  /** Variance classification relative to neighbours. */
  varianceBucket: CellVarianceBucket;
  /** Deviation from the field-level average (positive = above avg). */
  deltaFromFieldAvgPct: number;
  /** Percentile rank within the current field surface (0–100). */
  percentileInField: number;
  /** Local position relative to the field distribution. */
  anomalyClass: CellAnomalyClass;
  /** Tracked zone association, if any. */
  zoneId: string | null;
  /** Agronomic severity classification. */
  severityLabel: CellSeverityLabel;
  /** Field-level provenance context, when available from the moisture model. */
  provenance?: CellProvenanceContext | null;
};

export type FieldAgronomicSurfaceRenderModel = {
  id: string;
  kind: "field-agronomic-cell-surface";
  metricKey: FieldAgronomicSurfaceMetricKey;
  metricAveragePct: number;
  confidence: "low" | "medium" | "high";
  sourceLabel: string;
  baseElevationM: number;
  material: MapExtrusionMaterial;
  cells: FieldAgronomicCellRenderModel[];
};

export type FieldAgronomicAlternateCellRenderModel = Omit<
  FieldAgronomicCellRenderModel,
  "polygon" | "centroid"
>;

export type FieldAgronomicAlternateSurfaceRenderModel = Omit<
  FieldAgronomicSurfaceRenderModel,
  "cells"
> & {
  cells: Record<string, FieldAgronomicAlternateCellRenderModel>;
};
