import type { TimestampIso, WorkspaceId } from "@fieldpulse/platform-db";
import type { FieldHailRefreshRun } from "../contracts/FieldHailRefreshRun";
import type {
  HailRefreshFieldIssue,
  HailRefreshFieldLabel,
  HailRefreshMatchedField,
  HailRefreshNoSignalField,
  HailRefreshReport,
  HailRefreshWorkspaceSummary,
} from "../contracts/HailRefreshReport";

export type HailRefreshReportField = {
  workspaceId: WorkspaceId;
  fieldId: string;
};

export type BuildHailRefreshReportInput = {
  generatedAt?: TimestampIso;
  requestedAfter?: TimestampIso | null;
  staleBefore: TimestampIso;
  recentRuns: readonly FieldHailRefreshRun[];
  latestRuns: readonly FieldHailRefreshRun[];
  fields: readonly HailRefreshReportField[];
  fieldLabelsById?: Readonly<Record<string, HailRefreshFieldLabel>>;
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

export function buildHailRefreshReport(
  input: BuildHailRefreshReportInput,
): HailRefreshReport {
  const fieldLabelsById = input.fieldLabelsById ?? {};
  const workspaceSummaryMap = new Map<string, HailRefreshWorkspaceSummary>();
  const latestByFieldKey = new Map<string, FieldHailRefreshRun>();

  for (const run of input.latestRuns) {
    latestByFieldKey.set(`${run.workspaceId}:${run.fieldId}`, run);
  }

  const latestRecentByFieldKey = new Map<string, FieldHailRefreshRun>();
  for (const run of input.recentRuns) {
    const key = `${run.workspaceId}:${run.fieldId}`;
    if (!latestRecentByFieldKey.has(key)) {
      latestRecentByFieldKey.set(key, run);
    }
  }

  for (const run of input.recentRuns) {
    if (run.status !== "completed") {
      continue;
    }

    const labels = fieldLabelsById[run.fieldId] ?? {};
    const key = `${run.workspaceId}:${run.providerKey}`;
    const existing = workspaceSummaryMap.get(key);

    if (!existing) {
      workspaceSummaryMap.set(key, {
        workspaceId: run.workspaceId,
        workspaceName: labels.workspaceName ?? null,
        workspaceSlug: labels.workspaceSlug ?? null,
        providerKey: run.providerKey,
        refreshedFieldCount: 0,
        matchedFieldCount: 0,
        noSignalFieldCount: 0,
        matchedEventCount: run.matchedEventCount,
        latestRequestedAt: run.requestedAt,
        latestCompletedAt: run.completedAt,
      });
    } else {
      existing.matchedEventCount += run.matchedEventCount;
      existing.latestRequestedAt =
        existing.latestRequestedAt == null || existing.latestRequestedAt.localeCompare(run.requestedAt) < 0
          ? run.requestedAt
          : existing.latestRequestedAt;
      existing.latestCompletedAt =
        existing.latestCompletedAt == null ||
        (run.completedAt != null && existing.latestCompletedAt.localeCompare(run.completedAt) < 0)
          ? run.completedAt
          : existing.latestCompletedAt;
    }
  }

  for (const summary of workspaceSummaryMap.values()) {
    const matchingRuns = input.recentRuns.filter(
      (run) =>
        run.workspaceId === summary.workspaceId &&
        run.providerKey === summary.providerKey &&
        run.status === "completed",
    );
    const refreshedFieldIds = new Set(matchingRuns.map((run) => run.fieldId));
    const matchedFieldIds = new Set(
      matchingRuns
        .filter((run) => run.matchedEventCount > 0)
        .map((run) => run.fieldId),
    );

    summary.refreshedFieldCount = refreshedFieldIds.size;
    summary.matchedFieldCount = matchedFieldIds.size;
    summary.noSignalFieldCount = Math.max(0, refreshedFieldIds.size - matchedFieldIds.size);
  }

  const matchedFields: HailRefreshMatchedField[] = [];
  const noSignalFields: HailRefreshNoSignalField[] = [];

  for (const run of latestRecentByFieldKey.values()) {
    if (run.status !== "completed") {
      continue;
    }

    const labels = fieldLabelsById[run.fieldId] ?? {};

    if (run.matchedEventCount > 0) {
      matchedFields.push({
        workspaceId: run.workspaceId,
        workspaceName: labels.workspaceName ?? null,
        workspaceSlug: labels.workspaceSlug ?? null,
        fieldId: run.fieldId,
        fieldName: labels.fieldName ?? null,
        providerKey: run.providerKey,
        requestedAt: run.requestedAt,
        completedAt: run.completedAt,
        matchedEventCount: run.matchedEventCount,
        latestMatchedReportedAt: run.latestMatchedReportedAt,
      });
      continue;
    }

    noSignalFields.push({
      workspaceId: run.workspaceId,
      workspaceName: labels.workspaceName ?? null,
      workspaceSlug: labels.workspaceSlug ?? null,
      fieldId: run.fieldId,
      fieldName: labels.fieldName ?? null,
      providerKey: run.providerKey,
      requestedAt: run.requestedAt,
      completedAt: run.completedAt,
    });
  }

  matchedFields.sort((left, right) => sortIsoDesc(left.requestedAt, right.requestedAt));
  noSignalFields.sort((left, right) => sortIsoDesc(left.requestedAt, right.requestedAt));

  const staleFields: HailRefreshFieldIssue[] = [];

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
        lastRequestedAt: null,
        lastCompletedAt: null,
        ageHours: null,
        lastStatus: null,
        lastMatchedEventCount: null,
        lastErrorMessage: null,
        issueType: "missing-hail-refresh",
      });
      continue;
    }

    if (latest.status === "failed") {
      staleFields.push({
        workspaceId: field.workspaceId,
        workspaceName: labels.workspaceName ?? null,
        workspaceSlug: labels.workspaceSlug ?? null,
        fieldId: field.fieldId,
        fieldName: labels.fieldName ?? null,
        lastRequestedAt: latest.requestedAt,
        lastCompletedAt: latest.completedAt,
        ageHours: toAgeHours(latest.requestedAt, input.staleBefore),
        lastStatus: latest.status,
        lastMatchedEventCount: latest.matchedEventCount,
        lastErrorMessage: latest.errorMessage,
        issueType: "failed-hail-refresh",
      });
      continue;
    }

    if (latest.requestedAt.localeCompare(input.staleBefore) < 0) {
      staleFields.push({
        workspaceId: field.workspaceId,
        workspaceName: labels.workspaceName ?? null,
        workspaceSlug: labels.workspaceSlug ?? null,
        fieldId: field.fieldId,
        fieldName: labels.fieldName ?? null,
        lastRequestedAt: latest.requestedAt,
        lastCompletedAt: latest.completedAt,
        ageHours: toAgeHours(latest.requestedAt, input.staleBefore),
        lastStatus: latest.status,
        lastMatchedEventCount: latest.matchedEventCount,
        lastErrorMessage: latest.errorMessage,
        issueType: "stale-hail-refresh",
      });
    }
  }

  staleFields.sort((left, right) => {
    if (left.issueType !== right.issueType) {
      return left.issueType.localeCompare(right.issueType);
    }
    return sortIsoDesc(left.lastRequestedAt ?? "", right.lastRequestedAt ?? "");
  });

  const workspaceSummaries = Array.from(workspaceSummaryMap.values()).sort((left, right) => {
    if (left.workspaceId !== right.workspaceId) {
      return left.workspaceId.localeCompare(right.workspaceId);
    }

    if (right.matchedEventCount !== left.matchedEventCount) {
      return right.matchedEventCount - left.matchedEventCount;
    }

    return left.providerKey.localeCompare(right.providerKey);
  });

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    requestedAfter: input.requestedAfter ?? null,
    staleBefore: input.staleBefore,
    scannedRunCount: input.recentRuns.length,
    refreshedFieldCount: new Set(
      input.recentRuns
        .filter((run) => run.status === "completed")
        .map((run) => `${run.workspaceId}:${run.fieldId}`),
    ).size,
    matchedFieldCount: matchedFields.length,
    noSignalFieldCount: noSignalFields.length,
    staleFieldCount: staleFields.length,
    workspaceSummaries,
    matchedFields,
    noSignalFields,
    staleFields,
  };
}
