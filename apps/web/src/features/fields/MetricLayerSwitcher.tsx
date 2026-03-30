"use client";

import type { FieldAgronomicSurfaceMetricKey } from "@fieldpulse/map";

type MetricLayerSwitcherProps = {
  activeMetric: FieldAgronomicSurfaceMetricKey;
  availableMetrics: readonly FieldAgronomicSurfaceMetricKey[];
  onMetricChange: (metric: FieldAgronomicSurfaceMetricKey) => void;
};

const METRIC_SHORT_LABELS: Record<FieldAgronomicSurfaceMetricKey, string> = {
  "root-zone-moisture-pct": "Moisture",
  "surface-moisture-pct": "Surface",
  ndvi: "NDVI",
  ndre: "NDRE",
  ndmi: "NDMI",
  "radar-wetness": "Radar",
};

export function MetricLayerSwitcher({
  activeMetric,
  availableMetrics,
  onMetricChange,
}: MetricLayerSwitcherProps) {
  if (availableMetrics.length <= 1) return null;

  return (
    <div className="metric-switcher">
      {availableMetrics.map((metric) => (
        <button
          key={metric}
          type="button"
          className={`metric-switcher__btn${metric === activeMetric ? " metric-switcher__btn--active" : ""}`}
          onClick={() => onMetricChange(metric)}
        >
          {METRIC_SHORT_LABELS[metric]}
        </button>
      ))}
    </div>
  );
}
