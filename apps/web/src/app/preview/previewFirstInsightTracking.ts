import type { FieldSummaryProps } from "../../components/panels/SummaryTab";
import type { WorkspaceFirstInsightSummaryCard } from "../../features/fields/workspaceFirstInsightSummary";

export type PreviewFirstInsightTrackInput = {
  workspaceId: string | null;
  fieldId: string | null;
  activePanel: string;
  isGuestSession: boolean;
  summary: FieldSummaryProps | null;
  workspaceFirstInsightSummary: WorkspaceFirstInsightSummaryCard | null;
};

export type PreviewFirstInsightPayload = {
  workspaceId: string;
  fieldId: string;
  fieldName: string;
  dataQualityLabel: string | null;
  moistureConfidenceLevel: string | null;
  moistureDerivationMode: string;
  focusFieldId: string;
  focusFieldName: string;
  workspaceSummaryComparisonCount: number;
  source: "workspace-first-read";
};

const TRACKABLE_CONFIDENCE_LEVELS = new Set(["high", "medium"]);

export function buildPreviewFirstInsightSessionKey(
  input: Pick<PreviewFirstInsightPayload, "workspaceId" | "fieldId">,
) {
  return `preview:first-insight:${input.workspaceId}:${input.fieldId}`;
}

export function buildPreviewFirstInsightAuditPayload(
  input: PreviewFirstInsightTrackInput,
): PreviewFirstInsightPayload | null {
  if (input.isGuestSession) {
    return null;
  }

  if (input.activePanel !== "detail") {
    return null;
  }

  if (!input.workspaceId || !input.fieldId) {
    return null;
  }

  if (!input.workspaceFirstInsightSummary) {
    return null;
  }

  if (input.workspaceFirstInsightSummary.focusFieldId !== input.fieldId) {
    return null;
  }

  const summary = input.summary;
  const dataQualityLabel = summary?.dataQuality?.label ?? null;
  const moistureConfidenceLevel = summary?.moistureConfidenceLevel ?? null;

  const isTrackableField =
    dataQualityLabel === "Ready"
    || (
      dataQualityLabel === "Limited"
      && moistureConfidenceLevel != null
      && TRACKABLE_CONFIDENCE_LEVELS.has(moistureConfidenceLevel)
    );

  if (!isTrackableField) {
    return null;
  }

  return {
    workspaceId: input.workspaceId,
    fieldId: input.fieldId,
    fieldName: input.workspaceFirstInsightSummary.focusFieldName,
    dataQualityLabel,
    moistureConfidenceLevel,
    moistureDerivationMode: summary?.moistureDerivationMode ?? "unknown",
    focusFieldId: input.workspaceFirstInsightSummary.focusFieldId,
    focusFieldName: input.workspaceFirstInsightSummary.focusFieldName,
    workspaceSummaryComparisonCount:
      input.workspaceFirstInsightSummary.comparisons.length,
    source: "workspace-first-read",
  };
}
