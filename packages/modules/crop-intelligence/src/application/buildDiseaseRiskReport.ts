import type { TimestampIso, WorkspaceId } from "@fieldpulse/platform-db";
import type { CropIntelligenceRun } from "../contracts/CropIntelligenceRun";
import type { FieldIntelligenceFinding } from "../contracts/FieldIntelligenceFinding";
import type {
  ActiveDiseaseRiskField,
  DiseaseRiskFieldIssue,
  DiseaseRiskFieldLabel,
  DiseaseRiskNoSignalField,
  DiseaseRiskReport,
  DiseaseRiskWorkspaceSummary,
} from "../contracts/DiseaseRiskReport";

export type DiseaseRiskReportField = {
  workspaceId: WorkspaceId;
  fieldId: string;
};

export type BuildDiseaseRiskReportInput = {
  generatedAt?: TimestampIso;
  startedAfter?: TimestampIso | null;
  staleBefore: TimestampIso;
  recentRuns: readonly CropIntelligenceRun[];
  latestRuns: readonly CropIntelligenceRun[];
  activeFindings: readonly FieldIntelligenceFinding[];
  fields: readonly DiseaseRiskReportField[];
  fieldLabelsById?: Readonly<Record<string, DiseaseRiskFieldLabel>>;
};

function sortIsoDesc(left: string, right: string) {
  return right.localeCompare(left);
}

function toAgeHours(startedAt: string | null, staleBefore: string) {
  if (!startedAt) {
    return null;
  }

  const ageMs = new Date(staleBefore).getTime() - new Date(startedAt).getTime();

  if (!Number.isFinite(ageMs)) {
    return null;
  }

  return Math.max(0, Math.round((ageMs / (60 * 60 * 1000)) * 10) / 10);
}

function getDiseaseModelKey(finding: FieldIntelligenceFinding) {
  const metadata = finding.evidence.metadata;

  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const record = metadata as Record<string, unknown>;

  return typeof record.diseaseModelKey === "string"
    ? record.diseaseModelKey
    : null;
}

function severityRank(severity: FieldIntelligenceFinding["severity"]) {
  switch (severity) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
    default:
      return 1;
  }
}

export function buildDiseaseRiskReport(
  input: BuildDiseaseRiskReportInput,
): DiseaseRiskReport {
  const fieldLabelsById = input.fieldLabelsById ?? {};
  const latestRunByFieldKey = new Map<string, CropIntelligenceRun>();
  const latestRecentRunByFieldKey = new Map<string, CropIntelligenceRun>();
  const activeFindingsByFieldKey = new Map<string, FieldIntelligenceFinding[]>();
  const workspaceSummaryMap = new Map<string, DiseaseRiskWorkspaceSummary>();

  for (const run of input.latestRuns) {
    latestRunByFieldKey.set(`${run.workspaceId}:${run.fieldId}`, run);
  }

  for (const run of input.recentRuns) {
    const key = `${run.workspaceId}:${run.fieldId}`;
    if (!latestRecentRunByFieldKey.has(key)) {
      latestRecentRunByFieldKey.set(key, run);
    }
  }

  for (const finding of input.activeFindings) {
    const key = `${finding.workspaceId}:${finding.fieldId}`;
    const existing = activeFindingsByFieldKey.get(key) ?? [];
    existing.push(finding);
    activeFindingsByFieldKey.set(key, existing);
  }

  for (const run of input.recentRuns) {
    const labels = fieldLabelsById[run.fieldId] ?? {};
    const key = run.workspaceId;
    const existing = workspaceSummaryMap.get(key);

    if (!existing) {
      workspaceSummaryMap.set(key, {
        workspaceId: run.workspaceId,
        workspaceName: labels.workspaceName ?? null,
        workspaceSlug: labels.workspaceSlug ?? null,
        activeFindingCount: 0,
        activeFieldCount: 0,
        refreshedFieldCount: 0,
        noSignalFieldCount: 0,
        latestRunStartedAt: run.startedAt,
        latestRunCompletedAt: run.completedAt,
      });
      continue;
    }

    existing.latestRunStartedAt =
      existing.latestRunStartedAt == null ||
      existing.latestRunStartedAt.localeCompare(run.startedAt) < 0
        ? run.startedAt
        : existing.latestRunStartedAt;
    existing.latestRunCompletedAt =
      existing.latestRunCompletedAt == null ||
      (run.completedAt != null &&
        existing.latestRunCompletedAt.localeCompare(run.completedAt) < 0)
        ? run.completedAt
        : existing.latestRunCompletedAt;
  }

  for (const summary of workspaceSummaryMap.values()) {
    const recentRuns = input.recentRuns.filter(
      (run) => run.workspaceId === summary.workspaceId,
    );
    const refreshedFieldIds = new Set(recentRuns.map((run) => run.fieldId));
    const activeFieldIds = new Set(
      input.activeFindings
        .filter((finding) => finding.workspaceId === summary.workspaceId)
        .map((finding) => finding.fieldId),
    );

    summary.refreshedFieldCount = refreshedFieldIds.size;
    summary.activeFieldCount = activeFieldIds.size;
    summary.activeFindingCount = input.activeFindings.filter(
      (finding) => finding.workspaceId === summary.workspaceId,
    ).length;
    summary.noSignalFieldCount = Math.max(
      0,
      summary.refreshedFieldCount - summary.activeFieldCount,
    );
  }

  const activeFields: ActiveDiseaseRiskField[] = [];
  for (const [key, findings] of activeFindingsByFieldKey.entries()) {
    const [workspaceId, fieldId] = key.split(":");
    const labels = fieldLabelsById[fieldId] ?? {};
    const primary = [...findings].sort((left, right) => {
      const severityDifference = severityRank(right.severity) - severityRank(left.severity);
      if (severityDifference !== 0) {
        return severityDifference;
      }

      return sortIsoDesc(left.updatedAt, right.updatedAt);
    })[0]!;

    activeFields.push({
      workspaceId,
      workspaceName: labels.workspaceName ?? null,
      workspaceSlug: labels.workspaceSlug ?? null,
      fieldId,
      fieldName: labels.fieldName ?? null,
      severity: primary.severity,
      title: primary.title,
      confidence: primary.confidence,
      startedAt: primary.startedAt,
      updatedAt: primary.updatedAt,
      diseaseModelKey: getDiseaseModelKey(primary),
    });
  }

  activeFields.sort((left, right) => {
    const severityDifference = severityRank(right.severity) - severityRank(left.severity);
    if (severityDifference !== 0) {
      return severityDifference;
    }
    return sortIsoDesc(left.updatedAt, right.updatedAt);
  });

  const noSignalFields: DiseaseRiskNoSignalField[] = [];
  for (const run of latestRecentRunByFieldKey.values()) {
    const key = `${run.workspaceId}:${run.fieldId}`;
    if (activeFindingsByFieldKey.has(key)) {
      continue;
    }

    const labels = fieldLabelsById[run.fieldId] ?? {};
    noSignalFields.push({
      workspaceId: run.workspaceId,
      workspaceName: labels.workspaceName ?? null,
      workspaceSlug: labels.workspaceSlug ?? null,
      fieldId: run.fieldId,
      fieldName: labels.fieldName ?? null,
      latestRunStartedAt: run.startedAt,
      latestRunCompletedAt: run.completedAt,
    });
  }

  noSignalFields.sort((left, right) =>
    sortIsoDesc(left.latestRunStartedAt, right.latestRunStartedAt),
  );

  const staleFields: DiseaseRiskFieldIssue[] = [];
  for (const field of input.fields) {
    const key = `${field.workspaceId}:${field.fieldId}`;
    const latestRun = latestRunByFieldKey.get(key) ?? null;
    const labels = fieldLabelsById[field.fieldId] ?? {};

    if (!latestRun) {
      staleFields.push({
        workspaceId: field.workspaceId,
        workspaceName: labels.workspaceName ?? null,
        workspaceSlug: labels.workspaceSlug ?? null,
        fieldId: field.fieldId,
        fieldName: labels.fieldName ?? null,
        lastRunStartedAt: null,
        lastRunCompletedAt: null,
        ageHours: null,
        lastRunStatus: null,
        issueType: "missing-disease-eval",
      });
      continue;
    }

    if (latestRun.status === "failed") {
      staleFields.push({
        workspaceId: field.workspaceId,
        workspaceName: labels.workspaceName ?? null,
        workspaceSlug: labels.workspaceSlug ?? null,
        fieldId: field.fieldId,
        fieldName: labels.fieldName ?? null,
        lastRunStartedAt: latestRun.startedAt,
        lastRunCompletedAt: latestRun.completedAt,
        ageHours: toAgeHours(latestRun.startedAt, input.staleBefore),
        lastRunStatus: latestRun.status,
        issueType: "failed-disease-eval",
      });
      continue;
    }

    if (latestRun.startedAt.localeCompare(input.staleBefore) < 0) {
      staleFields.push({
        workspaceId: field.workspaceId,
        workspaceName: labels.workspaceName ?? null,
        workspaceSlug: labels.workspaceSlug ?? null,
        fieldId: field.fieldId,
        fieldName: labels.fieldName ?? null,
        lastRunStartedAt: latestRun.startedAt,
        lastRunCompletedAt: latestRun.completedAt,
        ageHours: toAgeHours(latestRun.startedAt, input.staleBefore),
        lastRunStatus: latestRun.status,
        issueType: "stale-disease-eval",
      });
    }
  }

  staleFields.sort((left, right) => {
    if (left.issueType !== right.issueType) {
      return left.issueType.localeCompare(right.issueType);
    }

    return sortIsoDesc(left.lastRunStartedAt ?? "", right.lastRunStartedAt ?? "");
  });

  const workspaceSummaries = Array.from(workspaceSummaryMap.values()).sort((left, right) => {
    if (left.workspaceId !== right.workspaceId) {
      return left.workspaceId.localeCompare(right.workspaceId);
    }

    if (right.activeFindingCount !== left.activeFindingCount) {
      return right.activeFindingCount - left.activeFindingCount;
    }

    return (left.workspaceSlug ?? "").localeCompare(right.workspaceSlug ?? "");
  });

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    startedAfter: input.startedAfter ?? null,
    staleBefore: input.staleBefore,
    scannedRunCount: input.recentRuns.length,
    refreshedFieldCount: new Set(
      input.recentRuns.map((run) => `${run.workspaceId}:${run.fieldId}`),
    ).size,
    activeFindingCount: input.activeFindings.length,
    activeFieldCount: activeFields.length,
    noSignalFieldCount: noSignalFields.length,
    staleFieldCount: staleFields.length,
    workspaceSummaries,
    activeFields,
    noSignalFields,
    staleFields,
  };
}
