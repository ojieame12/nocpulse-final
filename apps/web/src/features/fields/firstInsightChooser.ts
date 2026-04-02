export type FirstInsightFieldEntry = {
  fieldId: string;
  fieldName?: string | null;
};

export type FirstInsightHydrationStage = {
  state: 'pending' | 'completed';
};

export type FirstInsightHydrationSummary = {
  fieldId: string;
  fieldName?: string | null;
  status: 'queued' | 'completed';
  stages?: readonly FirstInsightHydrationStage[];
  coverage?: {
    hasWeatherObservation: boolean;
    hasRasterObservation: boolean;
    hasMoistureSnapshot: boolean;
  };
  moistureConfidence?: {
    level: 'low' | 'medium' | 'high' | 'unknown';
    derivationMode: 'source-backed' | 'seeded-range' | null;
    rasterMode: 'provider' | 'synthetic' | 'none' | null;
    score: number | null;
  } | null;
};

export const WORKSPACE_FIRST_INSIGHT_ALLOWLIST: Readonly<Record<string, readonly string[]>> = {
  '8f2afceb-aefe-4e90-a24e-7ab07c4423fe': [
    'Main Farm',
    'Rath',
    'Rath West',
    'Robbie',
    'Roman East Q',
    'Roman Yard',
    'Sigurson',
    'Solomon',
    'Towes',
    'Towes Dugout',
  ],
};

export function getWorkspaceFirstInsightAllowlist(workspaceId?: string | null) {
  if (!workspaceId) {
    return null;
  }

  return WORKSPACE_FIRST_INSIGHT_ALLOWLIST[workspaceId] ?? null;
}

function normalizeFieldName(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? null;
}

function areAllHydrationStagesCompleted(
  stages: readonly FirstInsightHydrationStage[] | null | undefined,
) {
  return Array.isArray(stages) && stages.length > 0 && stages.every((stage) => stage.state === 'completed');
}

function resolveHydrationTrustScore(summary: FirstInsightHydrationSummary | null | undefined) {
  if (!summary) {
    return 0;
  }

  let score = 0;

  if (summary.status === 'completed') {
    score += 100;
  }

  if (areAllHydrationStagesCompleted(summary.stages)) {
    score += 40;
  }

  const confidence = summary.moistureConfidence;
  if (confidence?.derivationMode === 'source-backed') {
    score += 20;
  }
  if (confidence?.rasterMode === 'provider') {
    score += 10;
  }

  switch (confidence?.level) {
    case 'high':
      score += 20;
      break;
    case 'medium':
      score += 12;
      break;
    case 'low':
      score += 4;
      break;
    default:
      break;
  }

  if (summary.coverage?.hasMoistureSnapshot) {
    score += 8;
  }
  if (summary.coverage?.hasRasterObservation) {
    score += 4;
  }
  if (summary.coverage?.hasWeatherObservation) {
    score += 4;
  }

  if (typeof confidence?.score === 'number' && Number.isFinite(confidence.score)) {
    score += confidence.score;
  }

  return score;
}

function isStrongFirstInsightCandidate(summary: FirstInsightHydrationSummary | null | undefined) {
  if (!summary || summary.status !== 'completed') {
    return false;
  }

  if (!areAllHydrationStagesCompleted(summary.stages)) {
    return false;
  }

  return summary.moistureConfidence?.level === 'high' || summary.moistureConfidence?.level === 'medium';
}

export function chooseFirstInsightField(options: {
  workspaceId?: string | null;
  preferredFieldId?: string | null;
  fieldEntries: readonly FirstInsightFieldEntry[];
  hydrationSummaries?: readonly FirstInsightHydrationSummary[] | null;
}) {
  const { workspaceId, preferredFieldId = null } = options;
  const allowlist = workspaceId ? WORKSPACE_FIRST_INSIGHT_ALLOWLIST[workspaceId] ?? null : null;
  const allowlistIndex = new Map(
    (allowlist ?? []).map((fieldName, index) => [normalizeFieldName(fieldName), index] as const),
  );
  const summaryById = new Map(
    (options.hydrationSummaries ?? []).map((summary) => [summary.fieldId, summary] as const),
  );
  const mergedEntries = new Map<string, { fieldId: string; fieldName: string | null }>();

  for (const entry of options.fieldEntries) {
    mergedEntries.set(entry.fieldId, {
      fieldId: entry.fieldId,
      fieldName: entry.fieldName ?? summaryById.get(entry.fieldId)?.fieldName ?? null,
    });
  }

  for (const summary of options.hydrationSummaries ?? []) {
    if (!mergedEntries.has(summary.fieldId)) {
      mergedEntries.set(summary.fieldId, {
        fieldId: summary.fieldId,
        fieldName: summary.fieldName ?? null,
      });
    }
  }

  const candidates = Array.from(mergedEntries.values()).map((entry) => ({
    ...entry,
    summary: summaryById.get(entry.fieldId) ?? null,
    allowlistRank:
      allowlistIndex.get(normalizeFieldName(entry.fieldName) ?? '__missing__') ?? Number.POSITIVE_INFINITY,
  }));

  if (candidates.length === 0) {
    return null;
  }

  const allowlistedCandidates =
    allowlist != null
      ? candidates.filter((candidate) => Number.isFinite(candidate.allowlistRank))
      : candidates;
  const pool = allowlistedCandidates.length > 0 ? allowlistedCandidates : candidates;
  const rankedStrongCandidates = pool
    .filter((candidate) => isStrongFirstInsightCandidate(candidate.summary))
    .sort((left, right) => {
      if (left.allowlistRank !== right.allowlistRank) {
        return left.allowlistRank - right.allowlistRank;
      }

      const scoreDelta =
        resolveHydrationTrustScore(right.summary) - resolveHydrationTrustScore(left.summary);
      if (scoreDelta !== 0) {
        return scoreDelta;
      }

      if (left.fieldId === preferredFieldId) {
        return -1;
      }
      if (right.fieldId === preferredFieldId) {
        return 1;
      }

      return (left.fieldName ?? left.fieldId).localeCompare(right.fieldName ?? right.fieldId);
    });

  if (rankedStrongCandidates.length > 0) {
    return rankedStrongCandidates[0]?.fieldId ?? null;
  }

  if (preferredFieldId && pool.some((candidate) => candidate.fieldId === preferredFieldId)) {
    return preferredFieldId;
  }

  if (pool.length === 1) {
    return pool[0]?.fieldId ?? null;
  }

  return null;
}
