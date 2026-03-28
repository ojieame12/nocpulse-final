import type { TimestampIso } from "@fieldpulse/platform-db";
import type { ImageryProviderProbeFallbackReport, ImageryProviderProbeFieldLabel } from "../contracts/ImageryProviderProbeFallbackReport";
import type { ImageryProviderProbeRecord } from "../contracts/ImageryProviderProbeRecord";

export type BuildImageryProviderProbeFallbackReportInput = {
  generatedAt?: TimestampIso;
  createdAfter?: TimestampIso | null;
  records: readonly ImageryProviderProbeRecord[];
  fieldLabelsById?: Readonly<Record<string, ImageryProviderProbeFieldLabel>>;
};

function isFallbackRecord(record: ImageryProviderProbeRecord) {
  return record.providerStatus !== "ready" || record.probeStatus !== "provider-scene";
}

function hasCachedQualityReuseHit(record: ImageryProviderProbeRecord) {
  return record.details.probeCachedQualityReuseHit === true;
}

function uniqueReasons(records: readonly ImageryProviderProbeRecord[]) {
  return Array.from(
    new Set(
      records
        .map((record) => record.probeReason ?? record.reason)
        .filter((reason): reason is string => Boolean(reason)),
    ),
  ).slice(0, 5);
}

function sortIsoDesc(left: string, right: string) {
  return right.localeCompare(left);
}

export function buildImageryProviderProbeFallbackReport(
  input: BuildImageryProviderProbeFallbackReportInput,
): ImageryProviderProbeFallbackReport {
  const latestRecordByFieldProvider = new Map<string, ImageryProviderProbeRecord>();

  for (const record of input.records) {
    const key = `${record.workspaceId}:${record.fieldId}:${record.provider}`;
    const existing = latestRecordByFieldProvider.get(key);

    if (!existing || existing.createdAt.localeCompare(record.createdAt) < 0) {
      latestRecordByFieldProvider.set(key, record);
    }
  }

  const latestRecords = Array.from(latestRecordByFieldProvider.values());
  const fallbackRecords = latestRecords.filter(isFallbackRecord);
  const fieldLabelsById = input.fieldLabelsById ?? {};
  const groupedByProvider = new Map<
    ImageryProviderProbeRecord["provider"],
    ImageryProviderProbeRecord[]
  >();

  for (const record of fallbackRecords) {
    const current = groupedByProvider.get(record.provider) ?? [];
    current.push(record);
    groupedByProvider.set(record.provider, current);
  }

  const providerSummaries = Array.from(groupedByProvider.entries())
    .map(([provider, records]) => ({
      provider,
      recordCount: records.length,
      affectedFieldCount: new Set(
        records.map((record) => `${record.workspaceId}:${record.fieldId}`),
      ).size,
      fallbackSceneCount: records.filter((record) => record.probeStatus === "fallback-scene")
        .length,
      noSceneCount: records.filter((record) => record.probeStatus === "no-scene").length,
      errorCount: records.filter((record) => record.probeStatus === "error").length,
      providerFallbackCount: records.filter((record) => record.providerStatus !== "ready")
        .length,
      cachedQualityReuseHitCount: records.filter(hasCachedQualityReuseHit).length,
      latestCreatedAt:
        records
          .map((record) => record.createdAt)
          .sort(sortIsoDesc)[0] ?? null,
      reasons: uniqueReasons(records),
    }))
    .sort((left, right) => {
      if (right.recordCount !== left.recordCount) {
        return right.recordCount - left.recordCount;
      }

      return left.provider.localeCompare(right.provider);
    });

  const fieldIssues = fallbackRecords
    .sort((left, right) => sortIsoDesc(left.createdAt, right.createdAt))
    .map((record) => {
      const labels = fieldLabelsById[record.fieldId] ?? {};

      return {
        workspaceId: record.workspaceId,
        workspaceName: labels.workspaceName ?? null,
        workspaceSlug: labels.workspaceSlug ?? null,
        fieldId: record.fieldId,
        fieldName: labels.fieldName ?? null,
        provider: record.provider,
        providerStatus: record.providerStatus,
        probeStatus: record.probeStatus,
        requestedAt: record.requestedAt,
        createdAt: record.createdAt,
        reason: record.probeReason ?? record.reason,
        cachedQualityReuseHit: hasCachedQualityReuseHit(record),
      };
    });

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    createdAfter: input.createdAfter ?? null,
    totalRecordCount: input.records.length,
    fallbackRecordCount: fallbackRecords.length,
    affectedFieldCount: new Set(
      fieldIssues.map((issue) => `${issue.workspaceId}:${issue.fieldId}`),
    ).size,
    cachedQualityReuseHitCount: fallbackRecords.filter(hasCachedQualityReuseHit).length,
    providerSummaries,
    fieldIssues,
  };
}
