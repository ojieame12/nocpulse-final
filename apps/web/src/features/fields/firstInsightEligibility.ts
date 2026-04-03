import type { FieldSummaryProps } from "../../components/panels/SummaryTab";

const TRACKABLE_CONFIDENCE_LEVELS = new Set(["high", "medium"]);

export function isTrackableFirstInsightSummary(
  summary: FieldSummaryProps | null | undefined,
): summary is FieldSummaryProps {
  if (!summary) {
    return false;
  }

  const dataQualityLabel = summary.dataQuality?.label ?? null;
  const moistureConfidenceLevel = summary.moistureConfidenceLevel ?? null;

  return (
    dataQualityLabel === "Ready"
    || (
      dataQualityLabel === "Limited"
      && moistureConfidenceLevel != null
      && TRACKABLE_CONFIDENCE_LEVELS.has(moistureConfidenceLevel)
    )
  );
}
