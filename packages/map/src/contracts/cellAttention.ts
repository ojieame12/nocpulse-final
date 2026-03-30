import type {
  CellAnomalyClass,
  CellSeverityLabel,
  FieldAgronomicSurfaceMetricKey,
} from "../domain/render/FieldAgronomicSurfaceRenderModel";

export type CellAttentionLevel = "stable" | "watch" | "critical";

type ResolveCellAttentionLevelInput = {
  metricKey: FieldAgronomicSurfaceMetricKey;
  severityLabel: CellSeverityLabel;
  anomalyClass: CellAnomalyClass;
  deltaFromFieldAvgPct: number;
  percentileInField: number;
};

function isMoistureMetric(metricKey: FieldAgronomicSurfaceMetricKey) {
  return (
    metricKey === "root-zone-moisture-pct" ||
    metricKey === "surface-moisture-pct"
  );
}

export function resolveCellAttentionLevel({
  metricKey,
  severityLabel,
  anomalyClass,
  deltaFromFieldAvgPct,
  percentileInField,
}: ResolveCellAttentionLevelInput): CellAttentionLevel {
  const absDelta = Math.abs(deltaFromFieldAvgPct);
  const extremePercentile =
    percentileInField <= 10 || percentileInField >= 90;
  const elevatedPercentile =
    percentileInField <= 20 || percentileInField >= 80;
  const localizedSignal = anomalyClass !== "near-field";
  const strongLocalizedSignal =
    localizedSignal && (absDelta >= 10 || extremePercentile);
  const moderateLocalizedSignal =
    localizedSignal && (absDelta >= 5 || elevatedPercentile);

  if (isMoistureMetric(metricKey)) {
    if (severityLabel === "critical") {
      return strongLocalizedSignal ? "critical" : "watch";
    }

    if (severityLabel === "stressed") {
      return "watch";
    }

    return moderateLocalizedSignal ? "watch" : "stable";
  }

  if (!localizedSignal && absDelta < 8) {
    return "stable";
  }

  if (severityLabel === "critical") {
    return strongLocalizedSignal ? "critical" : "watch";
  }

  if (severityLabel === "stressed") {
    return moderateLocalizedSignal ? "watch" : "stable";
  }

  if (strongLocalizedSignal || moderateLocalizedSignal) {
    return "watch";
  }

  return "stable";
}

export function describeCellAttentionLevel(level: CellAttentionLevel) {
  switch (level) {
    case "critical":
      return "Localized Critical";
    case "watch":
      return "Localized Watch";
    case "stable":
    default:
      return "Field Typical";
  }
}
