/**
 * Shared types for FieldDetailPanel and its extracted modules.
 *
 * Extracted from FieldDetailPanel.tsx — no behavior change.
 */

import type { FieldAgronomicSurfaceMetricKey } from "@fieldpulse/map";

/* ── Mode key ── */

export type ModeKey = "moisture" | "ndvi" | "ndre" | "ndmi" | "radarWetness";

export const MODE_TO_METRIC_KEY: Record<ModeKey, FieldAgronomicSurfaceMetricKey> = {
  moisture: "root-zone-moisture-pct",
  ndvi: "ndvi",
  ndre: "ndre",
  ndmi: "ndmi",
  radarWetness: "radar-wetness",
};

/* ── Severity ── */

export type SeverityKey = "positive" | "warning" | "danger";

/* ── Mode data (output of buildFieldDetailModeData) ── */

export type DetailPanelModeVital = {
  label: string;
  value: string;
  sev?: boolean;
  icon?: "up" | "down";
};

export type DetailPanelModeData = {
  hero: { v: number; d: string; u: string; sev: SeverityKey };
  headline: string;
  sub: string;
  contextOnly?: boolean;
  vitals: DetailPanelModeVital[];
  spark: number[];
  trendLabel: string;
  trendMeta: string;
  trendColor?: string;
  spatialColumns: readonly [
    { label: string; value: string },
    { label: string; value: string },
    { label: string; value: string },
  ];
  spatialProgressPct: number;
  belowThresholdLabel: string;
  belowThresholdValue: string;
  inZonesLabel: string;
  inZonesValue: string;
  interpretation: string;
  risk: string;
  riskLevel: string;
  sourceSummary: string;
};
