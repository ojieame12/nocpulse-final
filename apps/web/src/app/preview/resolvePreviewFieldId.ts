import { getWorkspaceFirstInsightAllowlist } from "../../features/fields/firstInsightChooser";

export type PreviewFieldSelection = {
  id: string;
  name?: string | null;
  latestMoisture?: {
    confidence: "low" | "medium" | "high";
    sourceKey: string;
  } | null;
};

export type PreviewWorkspaceSelection = {
  id: string;
  slug: string;
};

export function resolvePreferredPreviewWorkspaceId(
  workspaces: readonly PreviewWorkspaceSelection[],
  fallbackWorkspaceId: string,
) {
  return fallbackWorkspaceId;
}

export function resolvePreviewFieldId(
  fields: readonly PreviewFieldSelection[],
  workspaceId: string,
  primaryFieldId: string,
  requestedFieldId?: string,
) {
  if (fields.some((field) => field.id === requestedFieldId)) {
    return requestedFieldId!;
  }

  return (
    resolveAllowlistedPreviewFieldId(fields, workspaceId)
    ?? resolveRankedPreviewFieldId(fields, primaryFieldId)
    ?? primaryFieldId
  );
}

function resolveAllowlistedPreviewFieldId(
  fields: readonly PreviewFieldSelection[],
  workspaceId: string,
) {
  const allowlist = getWorkspaceFirstInsightAllowlist(workspaceId);
  if (!allowlist || allowlist.length === 0) {
    return null;
  }

  const allowlistIndex = new Map(
    allowlist.map((fieldName, index) => [normalizeFieldName(fieldName), index] as const),
  );

  const allowlistedFields = fields
    .map((field) => ({
      ...field,
      allowlistRank:
        allowlistIndex.get(normalizeFieldName(field.name) ?? "__missing__") ??
        Number.POSITIVE_INFINITY,
    }))
    .filter((field) => Number.isFinite(field.allowlistRank));

  if (allowlistedFields.length === 0) {
    return null;
  }

  const stronglyBackedFields = allowlistedFields.filter((field) => {
    const confidence = field.latestMoisture?.confidence;
    return confidence === "high" || confidence === "medium";
  });

  const pool = stronglyBackedFields.length > 0 ? stronglyBackedFields : allowlistedFields;
  pool.sort((left, right) => {
    if (left.allowlistRank !== right.allowlistRank) {
      return left.allowlistRank - right.allowlistRank;
    }

    const confidenceDelta =
      resolveMoistureConfidencePriority(right.latestMoisture?.confidence) -
      resolveMoistureConfidencePriority(left.latestMoisture?.confidence);
    if (confidenceDelta !== 0) {
      return confidenceDelta;
    }

    return (left.name ?? left.id).localeCompare(right.name ?? right.id);
  });

  return pool[0]?.id ?? null;
}

function resolveRankedPreviewFieldId(
  fields: readonly PreviewFieldSelection[],
  primaryFieldId: string,
) {
  if (fields.length === 0) {
    return null;
  }

  const rankedFields = [...fields].sort((left, right) => {
    const confidenceDelta =
      resolveMoistureConfidencePriority(right.latestMoisture?.confidence) -
      resolveMoistureConfidencePriority(left.latestMoisture?.confidence);
    if (confidenceDelta !== 0) {
      return confidenceDelta;
    }

    const leftHasSource = typeof left.latestMoisture?.sourceKey === "string" && left.latestMoisture.sourceKey.length > 0;
    const rightHasSource = typeof right.latestMoisture?.sourceKey === "string" && right.latestMoisture.sourceKey.length > 0;
    if (leftHasSource !== rightHasSource) {
      return rightHasSource ? 1 : -1;
    }

    if (left.id === primaryFieldId && right.id !== primaryFieldId) {
      return -1;
    }
    if (right.id === primaryFieldId && left.id !== primaryFieldId) {
      return 1;
    }

    return (left.name ?? left.id).localeCompare(right.name ?? right.id);
  });

  return rankedFields[0]?.id ?? null;
}

function normalizeFieldName(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? null;
}

function resolveMoistureConfidencePriority(
  confidence: NonNullable<PreviewFieldSelection["latestMoisture"]>["confidence"] | undefined,
) {
  switch (confidence) {
    case "high":
      return 2;
    case "medium":
      return 1;
    default:
      return 0;
  }
}
