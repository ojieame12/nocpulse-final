import { readAppEnv } from "@fieldpulse/platform-config";
import {
  createSupabaseDatabaseClient,
  requireSupabaseData,
  type DatabaseSchema,
} from "@fieldpulse/platform-db";
import { pathToFileURL } from "node:url";
import { runFieldQualityAudit, type FieldQualityAuditReport } from "./fieldQualityAudit";
import {
  buildPreviewFirstInsightReport,
  type PreviewFirstInsightEvent,
  type PreviewFirstInsightReport,
} from "./previewFirstInsightReport.shared";
import { loadWorkerEnv } from "./runtime/loadEnv";
import {
  parseCliArgs,
  readBooleanFlag,
  readNumberFlag,
  readStringFlag,
} from "./runtime/parseCliArgs";
import { createWorkerJobQueue } from "./runtime/createWorkerJobQueue";

type WorkspaceRow = Pick<
  DatabaseSchema["app"]["Tables"]["workspaces"]["Row"],
  "id" | "slug" | "name"
>;

type AuditEventRow = Pick<
  DatabaseSchema["app"]["Tables"]["audit_events"]["Row"],
  "actor_user_id" | "workspace_id" | "resource_id" | "metadata" | "created_at"
>;

type GateStatus = "GO" | "WARN" | "NO-GO";

type ActionBriefStatusSummary = {
  queuedCount: number;
  runningCount: number;
  completedCount: number;
  failedCount: number;
  cancelledCount: number;
};

type SourceIntegritySummary = {
  fieldCount: number;
  sourceBackedLatestCount: number;
  seededFallbackCount: number;
  syntheticRasterCount: number;
  missingSoilContextCount: number;
  lowConfidenceCount: number;
};

export type BetaReadinessGate = {
  key:
    | "queue-health"
    | "action-brief"
    | "source-integrity"
    | "field-quality"
    | "first-insight";
  label: string;
  status: GateStatus;
  summary: string;
};

export type BetaReadinessReport = {
  generatedAt: string;
  workspaceId: string | null;
  workspaceSlug: string | null;
  workspaceName: string | null;
  lookbackDays: number;
  overallStatus: GateStatus;
  gates: BetaReadinessGate[];
  nextActions: string[];
  queueHealth: Awaited<ReturnType<ReturnType<typeof createWorkerJobQueue>["getQueueHealth"]>>;
  actionBrief: ActionBriefStatusSummary;
  sourceIntegrity: SourceIntegritySummary;
  fieldQuality: FieldQualityAuditReport["summary"];
  firstInsight: Pick<
    PreviewFirstInsightReport,
    | "eventCount"
    | "uniqueActorCount"
    | "uniqueFieldCount"
    | "allowlistedEventCount"
    | "nonAllowlistedEventCount"
    | "averageWorkspaceSummaryComparisonCount"
  >;
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readNumber(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isoDaysAgo(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}

function toPreviewFirstInsightEvent(row: AuditEventRow): PreviewFirstInsightEvent | null {
  if (!row.resource_id || !isPlainRecord(row.metadata)) {
    return null;
  }

  const metadata = row.metadata;
  const fieldName = readString(metadata, "fieldName");
  const dataQualityLabel = readString(metadata, "dataQualityLabel");
  const moistureConfidenceLevel = readString(metadata, "moistureConfidenceLevel");
  const moistureDerivationMode = readString(metadata, "moistureDerivationMode");
  const focusFieldId = readString(metadata, "focusFieldId");
  const focusFieldName = readString(metadata, "focusFieldName");
  const workspaceSummaryComparisonCount = readNumber(
    metadata,
    "workspaceSummaryComparisonCount",
  );

  if (
    !fieldName ||
    (dataQualityLabel !== "Ready" && dataQualityLabel !== "Limited") ||
    (moistureConfidenceLevel !== "high" && moistureConfidenceLevel !== "medium") ||
    !moistureDerivationMode ||
    !focusFieldId ||
    !focusFieldName ||
    workspaceSummaryComparisonCount == null
  ) {
    return null;
  }

  return {
    createdAt: row.created_at,
    actorUserId: row.actor_user_id,
    workspaceId: row.workspace_id,
    fieldId: row.resource_id,
    fieldName,
    dataQualityLabel,
    moistureConfidenceLevel,
    moistureDerivationMode,
    workspaceSummaryComparisonCount,
    focusFieldId,
    focusFieldName,
  };
}

function summarizeActionBriefStatuses(
  rows: readonly {
    status: string;
    dispatchCount: number;
  }[],
): ActionBriefStatusSummary {
  const summary: ActionBriefStatusSummary = {
    queuedCount: 0,
    runningCount: 0,
    completedCount: 0,
    failedCount: 0,
    cancelledCount: 0,
  };

  for (const row of rows) {
    if (row.status === "queued") {
      summary.queuedCount += row.dispatchCount;
    } else if (row.status === "running") {
      summary.runningCount += row.dispatchCount;
    } else if (row.status === "completed") {
      summary.completedCount += row.dispatchCount;
    } else if (row.status === "failed") {
      summary.failedCount += row.dispatchCount;
    } else if (row.status === "cancelled") {
      summary.cancelledCount += row.dispatchCount;
    }
  }

  return summary;
}

function buildSourceIntegritySummary(
  fieldQuality: FieldQualityAuditReport["summary"],
): SourceIntegritySummary {
  return {
    fieldCount: fieldQuality.fieldCount,
    sourceBackedLatestCount: fieldQuality.sourceBackedLatestCount,
    seededFallbackCount: fieldQuality.seededFallbackCount,
    syntheticRasterCount: fieldQuality.syntheticRasterCount,
    missingSoilContextCount: fieldQuality.missingSoilContextCount,
    lowConfidenceCount: fieldQuality.lowConfidenceCount,
  };
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function worstStatus(current: GateStatus, next: GateStatus): GateStatus {
  const rank = {
    GO: 0,
    WARN: 1,
    "NO-GO": 2,
  } as const;

  return rank[next] > rank[current] ? next : current;
}

export function buildBetaReadinessAssessment(input: {
  queueHealth: BetaReadinessReport["queueHealth"];
  actionBrief: ActionBriefStatusSummary;
  sourceIntegrity: SourceIntegritySummary;
  fieldQuality: FieldQualityAuditReport["summary"];
  firstInsight: BetaReadinessReport["firstInsight"];
}): Pick<BetaReadinessReport, "overallStatus" | "gates" | "nextActions"> {
  const gates: BetaReadinessGate[] = [];
  const nextActions: string[] = [];

  const queueStatus: GateStatus =
    input.queueHealth.staleRunningCount > 0 || input.queueHealth.queuedCount >= 100
      ? "NO-GO"
      : input.queueHealth.queuedCount > 0 || input.queueHealth.runningCount > 0
        ? "WARN"
        : "GO";
  gates.push({
    key: "queue-health",
    label: "Queue health",
    status: queueStatus,
    summary:
      queueStatus === "GO"
        ? `Queue is clear (${input.queueHealth.queuedCount} queued, ${input.queueHealth.staleRunningCount} stale).`
        : queueStatus === "WARN"
          ? `Queue is active (${input.queueHealth.queuedCount} queued, ${input.queueHealth.runningCount} running) but not stale.`
          : `Queue needs intervention (${input.queueHealth.queuedCount} queued, ${input.queueHealth.staleRunningCount} stale running).`,
  });
  if (queueStatus !== "GO") {
    nextActions.push("Check worker queue health and clear stale/backlogged dispatches before widening beta access.");
  }

  const actionBriefStatus: GateStatus =
    input.actionBrief.completedCount === 0
      ? input.actionBrief.queuedCount > 0 || input.actionBrief.runningCount > 0
        ? "WARN"
        : "NO-GO"
      : input.actionBrief.failedCount > 0
        ? "WARN"
        : "GO";
  gates.push({
    key: "action-brief",
    label: "Action-brief cadence",
    status: actionBriefStatus,
    summary:
      actionBriefStatus === "GO"
        ? `Action-brief loop has completed dispatches (${input.actionBrief.completedCount} completed).`
        : actionBriefStatus === "WARN"
          ? `Action-brief loop is active but not yet clean (${input.actionBrief.completedCount} completed, ${input.actionBrief.failedCount} failed, ${input.actionBrief.runningCount + input.actionBrief.queuedCount} in flight).`
          : "Action-brief loop has no completed dispatch history yet.",
  });
  if (actionBriefStatus !== "GO") {
    nextActions.push("Verify action-brief cadence execution and review recent failed or missing dispatches.");
  }

  const sourceRiskCount =
    input.sourceIntegrity.seededFallbackCount
    + input.sourceIntegrity.syntheticRasterCount
    + input.sourceIntegrity.missingSoilContextCount;
  const sourceRiskShare =
    input.sourceIntegrity.fieldCount > 0
      ? sourceRiskCount / input.sourceIntegrity.fieldCount
      : 0;
  const sourceStatus: GateStatus =
    sourceRiskCount === 0 && input.sourceIntegrity.lowConfidenceCount === 0
      ? "GO"
      : sourceRiskShare <= 0.1
        ? "WARN"
        : "NO-GO";
  gates.push({
    key: "source-integrity",
    label: "Source integrity",
    status: sourceStatus,
    summary:
      sourceStatus === "GO"
        ? `Latest field context is source-backed across ${input.sourceIntegrity.fieldCount} fields.`
        : sourceStatus === "WARN"
          ? `${sourceRiskCount} field(s) still rely on fallback or missing soil context; ${input.sourceIntegrity.lowConfidenceCount} latest snapshot(s) are low confidence.`
          : `Source integrity is still weak (${sourceRiskCount} fallback/missing-context fields, ${input.sourceIntegrity.lowConfidenceCount} low-confidence latest snapshots).`,
  });
  if (sourceStatus !== "GO") {
    nextActions.push("Run field-quality/source-utilization follow-up on weak fields before expanding first impressions.");
  }

  const readyShare =
    input.fieldQuality.fieldCount > 0
      ? input.fieldQuality.readyCount / input.fieldQuality.fieldCount
      : 0;
  const fallbackOrBroken =
    input.fieldQuality.fallbackCount + input.fieldQuality.brokenCount;
  const fieldQualityStatus: GateStatus =
    input.fieldQuality.fieldCount === 0
      ? "NO-GO"
      : readyShare >= 0.5 && fallbackOrBroken === 0
        ? "GO"
        : readyShare >= 0.2 && fallbackOrBroken <= 2
          ? "WARN"
          : "NO-GO";
  gates.push({
    key: "field-quality",
    label: "Field quality",
    status: fieldQualityStatus,
    summary:
      fieldQualityStatus === "GO"
        ? `${input.fieldQuality.readyCount}/${input.fieldQuality.fieldCount} fields are ready (${formatPercent(readyShare)}).`
        : fieldQualityStatus === "WARN"
          ? `${input.fieldQuality.readyCount}/${input.fieldQuality.fieldCount} fields are ready (${formatPercent(readyShare)}); launch-visible curation is still required.`
          : `Too many weak fields for broad claims (${input.fieldQuality.readyCount} ready, ${input.fieldQuality.thinCount} thin, ${fallbackOrBroken} fallback/broken).`,
  });
  if (fieldQualityStatus !== "GO") {
    nextActions.push("Keep launch-visible field curation tight and continue long-tail field-quality cleanup.");
  }

  const firstInsightStatus: GateStatus =
    input.firstInsight.eventCount === 0
      ? "NO-GO"
      : input.firstInsight.averageWorkspaceSummaryComparisonCount != null
          && input.firstInsight.averageWorkspaceSummaryComparisonCount >= 2
        ? "GO"
        : "WARN";
  gates.push({
    key: "first-insight",
    label: "First-insight evidence",
    status: firstInsightStatus,
    summary:
      firstInsightStatus === "GO"
        ? `${input.firstInsight.eventCount} first-insight event(s) recorded across ${input.firstInsight.uniqueActorCount} actor(s).`
        : firstInsightStatus === "WARN"
          ? `${input.firstInsight.eventCount} first-insight event(s) exist, but comparison depth is still limited.`
          : "No first-insight evidence has been recorded yet for this scope.",
  });
  if (firstInsightStatus !== "GO") {
    nextActions.push("Run a real grower walkthrough and inspect first-insight funnel drop-off before broader release.");
  }

  let overallStatus: GateStatus = "GO";
  for (const gate of gates) {
    overallStatus = worstStatus(overallStatus, gate.status);
  }

  return {
    overallStatus,
    gates,
    nextActions,
  };
}

async function resolveWorkspace(
  client: ReturnType<typeof createSupabaseDatabaseClient>,
  input: {
    workspaceId?: string | null;
    workspaceSlug?: string | null;
  },
): Promise<WorkspaceRow | null> {
  if (input.workspaceId && input.workspaceSlug) {
    throw new Error("Provide only one of --workspace-id or --workspace-slug");
  }

  if (input.workspaceSlug) {
    return requireSupabaseData(
      await client
        .from("workspaces")
        .select("id,slug,name")
        .eq("slug", input.workspaceSlug)
        .maybeSingle(),
      "betaReadinessReport.workspaceBySlug",
    ) as WorkspaceRow | null;
  }

  if (input.workspaceId) {
    return requireSupabaseData(
      await client
        .from("workspaces")
        .select("id,slug,name")
        .eq("id", input.workspaceId)
        .maybeSingle(),
      "betaReadinessReport.workspaceById",
    ) as WorkspaceRow | null;
  }

  return null;
}

async function buildFirstInsightEvidence(input: {
  client: ReturnType<typeof createSupabaseDatabaseClient>;
  workspaceId: string | null;
  workspaceSlug: string | null;
  lookbackDays: number;
  limit: number;
}) {
  const lookbackIso = isoDaysAgo(input.lookbackDays);
  let auditQuery = input.client
    .from("audit_events")
    .select("actor_user_id,workspace_id,resource_id,metadata,created_at")
    .eq("action", "preview.first_insight_surfaced")
    .gte("created_at", lookbackIso)
    .order("created_at", { ascending: false })
    .limit(input.limit);

  if (input.workspaceId) {
    auditQuery = auditQuery.eq("workspace_id", input.workspaceId);
  }

  const auditRows = requireSupabaseData(
    await auditQuery,
    "betaReadinessReport.auditEvents",
  ) as readonly AuditEventRow[];

  const events = auditRows
    .map((row) => toPreviewFirstInsightEvent(row))
    .filter((event): event is PreviewFirstInsightEvent => event != null);

  return buildPreviewFirstInsightReport({
    generatedAt: new Date().toISOString(),
    workspaceFilter: input.workspaceId ?? input.workspaceSlug,
    workspaceId: input.workspaceId,
    workspaceSlug: input.workspaceSlug,
    lookbackDays: input.lookbackDays,
    events,
    recentLimit: 10,
  });
}

async function main() {
  loadWorkerEnv();
  const args = parseCliArgs();
  const asJson = readBooleanFlag(args, "json");
  const workspaceId = readStringFlag(args, "workspace-id");
  const workspaceSlug = readStringFlag(args, "workspace-slug");
  const lookbackDays = readNumberFlag(args, "days") ?? 30;
  const limit = readNumberFlag(args, "limit") ?? 200;
  const env = readAppEnv(process.env);

  if (!env.supabase.enabled || !env.supabase.url || !env.supabase.serviceRoleKey) {
    throw new Error("Supabase runtime is not configured");
  }

  const client = createSupabaseDatabaseClient({
    url: env.supabase.url,
    serviceKey: env.supabase.serviceRoleKey,
  });

  const workspace = await resolveWorkspace(client, { workspaceId, workspaceSlug });
  if ((workspaceId || workspaceSlug) && !workspace) {
    throw new Error(`Workspace not found for provided filter.`);
  }

  const resolvedWorkspaceId = workspace?.id ?? workspaceId ?? null;
  const resolvedWorkspaceSlug = workspace?.slug ?? workspaceSlug ?? null;
  const resolvedWorkspaceName = workspace?.name ?? null;

  const [fieldQualityAudit, queueHealth, actionBriefRows, firstInsightReport] =
    await Promise.all([
      runFieldQualityAudit({
        client,
        workspaceId: resolvedWorkspaceId,
        workspaceSlug: resolvedWorkspaceId ? null : resolvedWorkspaceSlug,
        limit,
        lookbackDays,
      }),
      createWorkerJobQueue().getQueueHealth(),
      createWorkerJobQueue().listDispatchSummary({
        keys: [
          "intelligence.schedule-workspace-action-brief",
          "intelligence.generate-action-brief",
        ],
        limit: 20,
      }),
      buildFirstInsightEvidence({
        client,
        workspaceId: resolvedWorkspaceId,
        workspaceSlug: resolvedWorkspaceSlug,
        lookbackDays,
        limit,
      }),
    ]);

  const actionBrief = summarizeActionBriefStatuses(actionBriefRows);
  const sourceIntegrity = buildSourceIntegritySummary(fieldQualityAudit.summary);
  const assessment = buildBetaReadinessAssessment({
    queueHealth,
    actionBrief,
    sourceIntegrity,
    fieldQuality: fieldQualityAudit.summary,
    firstInsight: {
      eventCount: firstInsightReport.eventCount,
      uniqueActorCount: firstInsightReport.uniqueActorCount,
      uniqueFieldCount: firstInsightReport.uniqueFieldCount,
      allowlistedEventCount: firstInsightReport.allowlistedEventCount,
      nonAllowlistedEventCount: firstInsightReport.nonAllowlistedEventCount,
      averageWorkspaceSummaryComparisonCount:
        firstInsightReport.averageWorkspaceSummaryComparisonCount,
    },
  });

  const report: BetaReadinessReport = {
    generatedAt: new Date().toISOString(),
    workspaceId: resolvedWorkspaceId,
    workspaceSlug: resolvedWorkspaceSlug,
    workspaceName: resolvedWorkspaceName,
    lookbackDays,
    overallStatus: assessment.overallStatus,
    gates: assessment.gates,
    nextActions: assessment.nextActions,
    queueHealth,
    actionBrief,
    sourceIntegrity,
    fieldQuality: fieldQualityAudit.summary,
    firstInsight: {
      eventCount: firstInsightReport.eventCount,
      uniqueActorCount: firstInsightReport.uniqueActorCount,
      uniqueFieldCount: firstInsightReport.uniqueFieldCount,
      allowlistedEventCount: firstInsightReport.allowlistedEventCount,
      nonAllowlistedEventCount: firstInsightReport.nonAllowlistedEventCount,
      averageWorkspaceSummaryComparisonCount:
        firstInsightReport.averageWorkspaceSummaryComparisonCount,
    },
  };

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(
    [
      `Generated: ${report.generatedAt}`,
      `Scope: ${report.workspaceName ?? report.workspaceSlug ?? report.workspaceId ?? "all workspaces"}`,
      `Window: last ${report.lookbackDays} day(s)`,
      `Overall: ${report.overallStatus}`,
    ].join("\n"),
  );

  console.log("\nGates:");
  console.table(
    report.gates.map((gate) => ({
      gate: gate.label,
      status: gate.status,
      summary: gate.summary,
    })),
  );

  console.log("\nKey metrics:");
  console.table([{
    readyFields: report.fieldQuality.readyCount,
    thinFields: report.fieldQuality.thinCount,
    fallbackFields: report.fieldQuality.fallbackCount,
    brokenFields: report.fieldQuality.brokenCount,
    sourceBackedLatest: report.sourceIntegrity.sourceBackedLatestCount,
    lowConfidenceLatest: report.sourceIntegrity.lowConfidenceCount,
    queuedJobs: report.queueHealth.queuedCount,
    runningJobs: report.queueHealth.runningCount,
    staleRunningJobs: report.queueHealth.staleRunningCount,
    actionBriefCompleted: report.actionBrief.completedCount,
    actionBriefFailed: report.actionBrief.failedCount,
    firstInsightEvents: report.firstInsight.eventCount,
    firstInsightActors: report.firstInsight.uniqueActorCount,
  }]);

  if (report.nextActions.length > 0) {
    console.log("\nNext actions:");
    for (const action of report.nextActions) {
      console.log(`- ${action}`);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown beta readiness failure";
    console.error(`[worker-beta-readiness] ${message}`);
    process.exitCode = 1;
  });
}
