import type { TimestampIso, WorkspaceId } from "@fieldpulse/platform-db";
import type { FieldWeatherObservation } from "../contracts/FieldWeatherObservation";
import type {
  WeatherRefreshFieldIssue,
  WeatherRefreshFieldLabel,
  WeatherRefreshReport,
  WeatherRefreshWorkspaceSummary,
} from "../contracts/WeatherRefreshReport";

export type WeatherRefreshReportField = {
  workspaceId: WorkspaceId;
  fieldId: string;
};

export type BuildWeatherRefreshReportInput = {
  generatedAt?: TimestampIso;
  updatedAfter?: TimestampIso | null;
  staleBefore: TimestampIso;
  recentObservations: readonly FieldWeatherObservation[];
  latestObservations: readonly FieldWeatherObservation[];
  fields: readonly WeatherRefreshReportField[];
  fieldLabelsById?: Readonly<Record<string, WeatherRefreshFieldLabel>>;
};

function sortIsoDesc(left: string, right: string) {
  return right.localeCompare(left);
}

function toAgeHours(updatedAt: string | null, staleBefore: string) {
  if (!updatedAt) {
    return null;
  }

  const ageMs = new Date(staleBefore).getTime() - new Date(updatedAt).getTime();

  if (!Number.isFinite(ageMs)) {
    return null;
  }

  return Math.max(0, Math.round((ageMs / (60 * 60 * 1000)) * 10) / 10);
}

export function buildWeatherRefreshReport(
  input: BuildWeatherRefreshReportInput,
): WeatherRefreshReport {
  const fieldLabelsById = input.fieldLabelsById ?? {};
  const workspaceSummaryMap = new Map<string, WeatherRefreshWorkspaceSummary>();
  const refreshedFieldKeys = new Set(
    input.recentObservations.map((observation) => `${observation.workspaceId}:${observation.fieldId}`),
  );
  const latestByFieldKey = new Map<string, FieldWeatherObservation>();

  for (const observation of input.latestObservations) {
    latestByFieldKey.set(`${observation.workspaceId}:${observation.fieldId}`, observation);
  }

  for (const observation of input.recentObservations) {
    const labels = fieldLabelsById[observation.fieldId] ?? {};
    const key = `${observation.workspaceId}:${observation.providerKey}`;
    const existing = workspaceSummaryMap.get(key);

    if (!existing) {
      workspaceSummaryMap.set(key, {
        workspaceId: observation.workspaceId,
        workspaceName: labels.workspaceName ?? null,
        workspaceSlug: labels.workspaceSlug ?? null,
        providerKey: observation.providerKey,
        refreshedObservationCount: 1,
        refreshedFieldCount: 1,
        latestObservedAt: observation.observedAt,
        latestUpdatedAt: observation.updatedAt,
      });
      continue;
    }

    existing.refreshedObservationCount += 1;
    existing.latestObservedAt =
      existing.latestObservedAt == null || existing.latestObservedAt.localeCompare(observation.observedAt) < 0
        ? observation.observedAt
        : existing.latestObservedAt;
    existing.latestUpdatedAt =
      existing.latestUpdatedAt == null || existing.latestUpdatedAt.localeCompare(observation.updatedAt) < 0
        ? observation.updatedAt
        : existing.latestUpdatedAt;
  }

  for (const summary of workspaceSummaryMap.values()) {
    summary.refreshedFieldCount = new Set(
      input.recentObservations
        .filter(
          (observation) =>
            observation.workspaceId === summary.workspaceId
            && observation.providerKey === summary.providerKey,
        )
        .map((observation) => observation.fieldId),
    ).size;
  }

  const staleFields: WeatherRefreshFieldIssue[] = [];

  for (const field of input.fields) {
    const key = `${field.workspaceId}:${field.fieldId}`;
    const latest = latestByFieldKey.get(key) ?? null;
    const labels = fieldLabelsById[field.fieldId] ?? {};

    if (!latest) {
      staleFields.push({
        workspaceId: field.workspaceId,
        workspaceName: labels.workspaceName ?? null,
        workspaceSlug: labels.workspaceSlug ?? null,
        fieldId: field.fieldId,
        fieldName: labels.fieldName ?? null,
        lastObservedAt: null,
        lastUpdatedAt: null,
        ageHours: null,
        issueType: "missing-weather",
      });
      continue;
    }

    if (latest.updatedAt.localeCompare(input.staleBefore) < 0) {
      staleFields.push({
        workspaceId: field.workspaceId,
        workspaceName: labels.workspaceName ?? null,
        workspaceSlug: labels.workspaceSlug ?? null,
        fieldId: field.fieldId,
        fieldName: labels.fieldName ?? null,
        lastObservedAt: latest.observedAt,
        lastUpdatedAt: latest.updatedAt,
        ageHours: toAgeHours(latest.updatedAt, input.staleBefore),
        issueType: "stale-weather",
      });
    }
  }

  staleFields.sort((left, right) => {
    if (left.issueType !== right.issueType) {
      return left.issueType.localeCompare(right.issueType);
    }

    return sortIsoDesc(left.lastUpdatedAt ?? "", right.lastUpdatedAt ?? "");
  });

  const workspaceSummaries = Array.from(workspaceSummaryMap.values()).sort((left, right) => {
    if (left.workspaceId !== right.workspaceId) {
      return left.workspaceId.localeCompare(right.workspaceId);
    }

    if (right.refreshedObservationCount !== left.refreshedObservationCount) {
      return right.refreshedObservationCount - left.refreshedObservationCount;
    }

    return left.providerKey.localeCompare(right.providerKey);
  });

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    updatedAfter: input.updatedAfter ?? null,
    staleBefore: input.staleBefore,
    scannedObservationCount: input.recentObservations.length,
    refreshedFieldCount: refreshedFieldKeys.size,
    staleFieldCount: staleFields.length,
    workspaceSummaries,
    staleFields,
  };
}
