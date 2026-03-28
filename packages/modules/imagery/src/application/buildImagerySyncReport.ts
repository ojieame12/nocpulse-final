import type { TimestampIso, WorkspaceId } from "@fieldpulse/platform-db";
import type { ImageryCapture } from "../contracts/ImageryCapture";
import type {
  ImagerySyncFieldIssue,
  ImagerySyncFieldLabel,
  ImagerySyncReport,
  ImagerySyncWorkspaceSummary,
} from "../contracts/ImagerySyncReport";

export type ImagerySyncReportField = {
  workspaceId: WorkspaceId;
  fieldId: string;
};

export type BuildImagerySyncReportInput = {
  generatedAt?: TimestampIso;
  createdAfter?: TimestampIso | null;
  staleBefore: TimestampIso;
  recentCaptures: readonly ImageryCapture[];
  latestCaptures: readonly ImageryCapture[];
  fields: readonly ImagerySyncReportField[];
  fieldLabelsById?: Readonly<Record<string, ImagerySyncFieldLabel>>;
};

function sortIsoDesc(left: string, right: string) {
  return right.localeCompare(left);
}

export function buildImagerySyncReport(
  input: BuildImagerySyncReportInput,
): ImagerySyncReport {
  const fieldLabelsById = input.fieldLabelsById ?? {};
  const workspaceSummaryMap = new Map<string, ImagerySyncWorkspaceSummary>();
  const latestByFieldKey = new Map<string, ImageryCapture>();
  const refreshedFieldKeys = new Set(
    input.recentCaptures.map((capture) => `${capture.workspaceId}:${capture.fieldId}`),
  );

  for (const capture of input.latestCaptures) {
    latestByFieldKey.set(`${capture.workspaceId}:${capture.fieldId}`, capture);
  }

  for (const capture of input.recentCaptures) {
    const labels = fieldLabelsById[capture.fieldId] ?? {};
    const key = `${capture.workspaceId}:${capture.providerKey}`;
    const existing = workspaceSummaryMap.get(key);

    if (!existing) {
      workspaceSummaryMap.set(key, {
        workspaceId: capture.workspaceId,
        workspaceName: labels.workspaceName ?? null,
        workspaceSlug: labels.workspaceSlug ?? null,
        providerKey: capture.providerKey,
        captureCount: 1,
        refreshedFieldCount: 1,
        materializedFieldCount: capture.status === "materialized" ? 1 : 0,
        unavailableFieldCount: capture.status === "unavailable" ? 1 : 0,
        latestRequestedAt: capture.requestedAt,
        latestCapturedAt: capture.capturedAt,
      });
      continue;
    }

    existing.captureCount += 1;
    existing.materializedFieldCount += capture.status === "materialized" ? 1 : 0;
    existing.unavailableFieldCount += capture.status === "unavailable" ? 1 : 0;
    existing.latestRequestedAt =
      existing.latestRequestedAt == null ||
      existing.latestRequestedAt.localeCompare(capture.requestedAt) < 0
        ? capture.requestedAt
        : existing.latestRequestedAt;
    existing.latestCapturedAt =
      existing.latestCapturedAt == null ||
      existing.latestCapturedAt.localeCompare(capture.capturedAt) < 0
        ? capture.capturedAt
        : existing.latestCapturedAt;
  }

  for (const summary of workspaceSummaryMap.values()) {
    summary.refreshedFieldCount = new Set(
      input.recentCaptures
        .filter(
          (capture) =>
            capture.workspaceId === summary.workspaceId &&
            capture.providerKey === summary.providerKey,
        )
        .map((capture) => capture.fieldId),
    ).size;
  }

  const fieldIssues: ImagerySyncFieldIssue[] = [];

  for (const field of input.fields) {
    const key = `${field.workspaceId}:${field.fieldId}`;
    const latest = latestByFieldKey.get(key) ?? null;
    const labels = fieldLabelsById[field.fieldId] ?? {};

    if (!latest) {
      fieldIssues.push({
        workspaceId: field.workspaceId,
        workspaceName: labels.workspaceName ?? null,
        workspaceSlug: labels.workspaceSlug ?? null,
        fieldId: field.fieldId,
        fieldName: labels.fieldName ?? null,
        lastRequestedAt: null,
        lastCapturedAt: null,
        lastProviderKey: null,
        lastStatus: null,
        issueType: "missing-imagery",
      });
      continue;
    }

    if (latest.status === "unavailable") {
      fieldIssues.push({
        workspaceId: field.workspaceId,
        workspaceName: labels.workspaceName ?? null,
        workspaceSlug: labels.workspaceSlug ?? null,
        fieldId: field.fieldId,
        fieldName: labels.fieldName ?? null,
        lastRequestedAt: latest.requestedAt,
        lastCapturedAt: latest.capturedAt,
        lastProviderKey: latest.providerKey,
        lastStatus: latest.status,
        issueType: "unavailable-imagery",
      });
      continue;
    }

    if (latest.requestedAt.localeCompare(input.staleBefore) < 0) {
      fieldIssues.push({
        workspaceId: field.workspaceId,
        workspaceName: labels.workspaceName ?? null,
        workspaceSlug: labels.workspaceSlug ?? null,
        fieldId: field.fieldId,
        fieldName: labels.fieldName ?? null,
        lastRequestedAt: latest.requestedAt,
        lastCapturedAt: latest.capturedAt,
        lastProviderKey: latest.providerKey,
        lastStatus: latest.status,
        issueType: "stale-imagery",
      });
    }
  }

  fieldIssues.sort((left, right) => {
    if (left.issueType !== right.issueType) {
      return left.issueType.localeCompare(right.issueType);
    }

    return sortIsoDesc(left.lastRequestedAt ?? "", right.lastRequestedAt ?? "");
  });

  const workspaceSummaries = Array.from(workspaceSummaryMap.values()).sort(
    (left, right) => {
      if (left.workspaceId !== right.workspaceId) {
        return left.workspaceId.localeCompare(right.workspaceId);
      }

      if (right.captureCount !== left.captureCount) {
        return right.captureCount - left.captureCount;
      }

      return left.providerKey.localeCompare(right.providerKey);
    },
  );

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    createdAfter: input.createdAfter ?? null,
    staleBefore: input.staleBefore,
    scannedCaptureCount: input.recentCaptures.length,
    refreshedFieldCount: refreshedFieldKeys.size,
    materializedFieldCount: new Set(
      input.recentCaptures
        .filter((capture) => capture.status === "materialized")
        .map((capture) => `${capture.workspaceId}:${capture.fieldId}`),
    ).size,
    unavailableFieldCount: new Set(
      input.recentCaptures
        .filter((capture) => capture.status === "unavailable")
        .map((capture) => `${capture.workspaceId}:${capture.fieldId}`),
    ).size,
    staleFieldCount: fieldIssues.length,
    workspaceSummaries,
    fieldIssues,
  };
}
