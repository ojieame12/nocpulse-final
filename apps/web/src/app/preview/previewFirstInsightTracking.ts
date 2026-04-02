import type { FieldViewModel } from "./PreviewShell";
import type { WorkspaceFirstInsightSummaryCard } from "../../features/fields/workspaceFirstInsightSummary";

export type PreviewFirstInsightAuditPayload = {
  workspaceId: string;
  fieldId: string;
  fieldName: string;
  dataQualityLabel: "Ready" | "Limited";
  moistureConfidenceLevel: "high" | "medium";
  moistureDerivationMode: string;
  workspaceSummaryComparisonCount: number;
  focusFieldId: string;
  focusFieldName: string;
};

export function buildPreviewFirstInsightAuditPayload(input: {
  workspaceId?: string | null;
  fieldData: FieldViewModel;
  workspaceFirstInsightSummary?: WorkspaceFirstInsightSummaryCard | null;
}): PreviewFirstInsightAuditPayload | null {
  const workspaceId = input.workspaceId?.trim() ?? "";
  if (!workspaceId || !input.workspaceFirstInsightSummary) {
    return null;
  }

  const { fieldData, workspaceFirstInsightSummary } = input;
  const summary = fieldData.summary;
  const dataQuality = summary?.dataQuality ?? null;
  const confidence = summary?.moistureConfidenceLevel ?? "unknown";

  if (!summary || !dataQuality) {
    return null;
  }

  if (fieldData.fieldId !== workspaceFirstInsightSummary.focusFieldId) {
    return null;
  }

  const eligible =
    dataQuality.label === "Ready" ||
    (dataQuality.label === "Limited" &&
      (confidence === "high" || confidence === "medium"));

  if (!eligible) {
    return null;
  }

  if (confidence !== "high" && confidence !== "medium") {
    return null;
  }

  return {
    workspaceId,
    fieldId: fieldData.fieldId,
    fieldName: fieldData.fieldName,
    dataQualityLabel: dataQuality.label,
    moistureConfidenceLevel: confidence,
    moistureDerivationMode: summary.moistureDerivationMode,
    workspaceSummaryComparisonCount:
      workspaceFirstInsightSummary.comparisons.length,
    focusFieldId: workspaceFirstInsightSummary.focusFieldId,
    focusFieldName: workspaceFirstInsightSummary.focusFieldName,
  };
}

export function buildPreviewFirstInsightSessionKey(
  payload: PreviewFirstInsightAuditPayload,
) {
  return `fieldpulse:first-insight-surfaced:${payload.workspaceId}:${payload.fieldId}`;
}
