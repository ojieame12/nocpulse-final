import type { MapExtrusionMaterial } from "../../contracts/material";
import type { MapGeoPoint, MapRgbaColor } from "./FieldBoundaryPreviewRenderModel";

export type FieldAgronomicSurfaceMetricKey =
  | "ndvi"
  | "ndre"
  | "ndmi"
  | "root-zone-moisture-pct"
  | "surface-moisture-pct";

export type CellVarianceBucket = "low" | "medium" | "high";
export type CellSeverityLabel = "healthy" | "stressed" | "critical" | null;
export type CellSourceTier =
  | "fresh-sar"
  | "stale-sar"
  | "twi-prior"
  | "model-only"
  | "sentinel-fresh"
  | "sentinel-stale"
  | "synthetic";

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
  /** Tracked zone association, if any. */
  zoneId: string | null;
  /** Agronomic severity classification. */
  severityLabel: CellSeverityLabel;
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
