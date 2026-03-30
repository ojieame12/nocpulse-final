import type {
  FieldAgronomicSurfaceMetricKey,
  CellVarianceBucket,
  CellSeverityLabel,
  CellSourceTier,
  CellAnomalyClass,
} from "../render/FieldAgronomicSurfaceRenderModel";

/**
 * Emitted on hover over a cell. `null` when the pointer leaves all cells.
 */
export type CellHoverEvent = {
  cellId: string;
  metricKey: FieldAgronomicSurfaceMetricKey;
  metricValuePct: number;
  displayHeightM: number;
  /** Viewport-relative X coordinate (px from left). */
  screenX: number;
  /** Viewport-relative Y coordinate (px from top). */
  screenY: number;

  // ── Analytics context ──
  confidence: number;
  sourceTier: CellSourceTier;
  deltaFromFieldAvgPct: number;
  percentileInField: number;
  anomalyClass: CellAnomalyClass;
  varianceBucket: CellVarianceBucket;
  severityLabel: CellSeverityLabel;
  zoneId: string | null;
};

/**
 * Emitted on click/tap on a cell.
 */
export type CellClickEvent = {
  cellId: string;
  metricKey: FieldAgronomicSurfaceMetricKey;
  metricValuePct: number;
  displayHeightM: number;
  selected: boolean;
  /** Viewport-relative X coordinate (px from left). */
  screenX: number;
  /** Viewport-relative Y coordinate (px from top). */
  screenY: number;

  // ── Analytics context ──
  confidence: number;
  sourceTier: CellSourceTier;
  deltaFromFieldAvgPct: number;
  percentileInField: number;
  anomalyClass: CellAnomalyClass;
  varianceBucket: CellVarianceBucket;
  severityLabel: CellSeverityLabel;
  zoneId: string | null;
};
