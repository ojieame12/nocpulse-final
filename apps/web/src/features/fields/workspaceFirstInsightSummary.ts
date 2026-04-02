import type { FieldSummaryProps } from "../../components/panels/SummaryTab";
import { getWorkspaceFirstInsightAllowlist } from "./firstInsightChooser";

export type WorkspaceFirstInsightFieldSnapshot = {
  fieldId: string;
  fieldName: string;
  summary: FieldSummaryProps | null;
};

export type WorkspaceFirstInsightComparison = {
  label: string;
  fieldId: string;
  fieldName: string;
  value: string;
  note: string;
};

export type WorkspaceFirstInsightSummaryCard = {
  focusFieldId: string;
  focusFieldName: string;
  headline: string;
  summary: string;
  comparisons: readonly WorkspaceFirstInsightComparison[];
};

type EligibleFieldSnapshot = WorkspaceFirstInsightFieldSnapshot & {
  summary: FieldSummaryProps;
  trendValue: number | null;
  allowlistRank: number;
};

function normalizeFieldName(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? null;
}

function parseTrendPercent(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/[−–]/g, "-").replace(/[^0-9+.-]/g, "");
  if (!normalized) {
    return null;
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function isConfidenceStrong(summary: FieldSummaryProps) {
  return (
    summary.moistureConfidenceLevel === "high"
    || summary.moistureConfidenceLevel === "medium"
  );
}

function isEligibleForWorkspaceInsight(summary: FieldSummaryProps | null) {
  if (!summary?.dataQuality) {
    return false;
  }

  return (
    summary.dataQuality.label === "Ready"
    || (summary.dataQuality.label === "Limited" && isConfidenceStrong(summary))
  );
}

function compareByFocusPriority(
  left: EligibleFieldSnapshot,
  right: EligibleFieldSnapshot,
  activeFieldId: string | null,
) {
  if (left.allowlistRank !== right.allowlistRank) {
    return left.allowlistRank - right.allowlistRank;
  }

  if (left.fieldId === activeFieldId && right.fieldId !== activeFieldId) {
    return -1;
  }
  if (right.fieldId === activeFieldId && left.fieldId !== activeFieldId) {
    return 1;
  }

  const leftReady = left.summary.dataQuality?.label === "Ready" ? 1 : 0;
  const rightReady = right.summary.dataQuality?.label === "Ready" ? 1 : 0;
  if (leftReady !== rightReady) {
    return rightReady - leftReady;
  }

  const leftConfidence = left.summary.moistureConfidenceLevel === "high" ? 2 : 1;
  const rightConfidence = right.summary.moistureConfidenceLevel === "high" ? 2 : 1;
  if (leftConfidence !== rightConfidence) {
    return rightConfidence - leftConfidence;
  }

  return (left.fieldName || left.fieldId).localeCompare(right.fieldName || right.fieldId);
}

export function buildWorkspaceFirstInsightSummary(options: {
  workspaceId?: string | null;
  activeFieldId?: string | null;
  fields: readonly WorkspaceFirstInsightFieldSnapshot[];
}): WorkspaceFirstInsightSummaryCard | null {
  const allowlist = getWorkspaceFirstInsightAllowlist(options.workspaceId);
  const allowlistIndex = new Map(
    (allowlist ?? []).map((fieldName, index) => [normalizeFieldName(fieldName), index] as const),
  );

  const eligibleFields = options.fields
    .filter((field): field is WorkspaceFirstInsightFieldSnapshot & { summary: FieldSummaryProps } =>
      isEligibleForWorkspaceInsight(field.summary),
    )
    .map((field) => ({
      ...field,
      trendValue: parseTrendPercent(field.summary.trend),
      allowlistRank:
        allowlistIndex.get(normalizeFieldName(field.fieldName) ?? "__missing__")
        ?? Number.POSITIVE_INFINITY,
    }));

  if (eligibleFields.length < 2) {
    return null;
  }

  const rankedEligibleFields = [...eligibleFields].sort((left, right) =>
    compareByFocusPriority(left, right, options.activeFieldId ?? null),
  );
  const focusField = rankedEligibleFields[0];

  if (!focusField) {
    return null;
  }

  const wettestField = [...eligibleFields].sort((left, right) => right.summary.moisture - left.summary.moisture)[0];
  const driestField = [...eligibleFields].sort((left, right) => left.summary.moisture - right.summary.moisture)[0];
  const mostChangedField = [...eligibleFields].sort((left, right) => {
    const rightDelta = Math.abs(right.trendValue ?? -1);
    const leftDelta = Math.abs(left.trendValue ?? -1);
    if (rightDelta !== leftDelta) {
      return rightDelta - leftDelta;
    }

    return (left.fieldName || left.fieldId).localeCompare(right.fieldName || right.fieldId);
  })[0];

  const comparisons: WorkspaceFirstInsightComparison[] = [];

  if (wettestField) {
    comparisons.push({
      label: "Wettest ready field",
      fieldId: wettestField.fieldId,
      fieldName: wettestField.fieldName,
      value: wettestField.summary.rootMoisture,
      note: wettestField.summary.fieldState,
    });
  }

  if (driestField) {
    comparisons.push({
      label: "Driest ready field",
      fieldId: driestField.fieldId,
      fieldName: driestField.fieldName,
      value: driestField.summary.rootMoisture,
      note: driestField.summary.fieldState,
    });
  }

  if (mostChangedField) {
    comparisons.push({
      label: "Most changed this week",
      fieldId: mostChangedField.fieldId,
      fieldName: mostChangedField.fieldName,
      value: mostChangedField.summary.trend,
      note: mostChangedField.summary.trendSub,
    });
  }

  const allowlistScopedCount =
    allowlist != null
      ? eligibleFields.filter((field) => Number.isFinite(field.allowlistRank)).length
      : eligibleFields.length;
  const comparisonScopeCount = allowlistScopedCount > 0 ? allowlistScopedCount : eligibleFields.length;
  const scopeLabel = comparisonScopeCount === 1 ? "ready field" : "ready fields";
  const focusPrefix =
    focusField.fieldId === options.activeFieldId
      ? `${focusField.fieldName} is the clearest field to start with right now.`
      : `Start with ${focusField.fieldName}.`;

  return {
    focusFieldId: focusField.fieldId,
    focusFieldName: focusField.fieldName,
    headline: "Workspace first read",
    summary: `${focusPrefix} Across ${comparisonScopeCount} ${scopeLabel}, this gives you the quickest read on current conditions before you compare the rest.`,
    comparisons,
  };
}
