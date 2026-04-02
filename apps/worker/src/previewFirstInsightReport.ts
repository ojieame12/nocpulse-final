import { readAppEnv } from "@fieldpulse/platform-config";
import {
  createSupabaseDatabaseClient,
  requireSupabaseData,
  type DatabaseSchema,
} from "@fieldpulse/platform-db";
import { loadWorkerEnv } from "./runtime/loadEnv";
import {
  parseCliArgs,
  readBooleanFlag,
  readNumberFlag,
  readStringFlag,
} from "./runtime/parseCliArgs";
import {
  buildPreviewFirstInsightReport,
  type PreviewFirstInsightEvent,
} from "./previewFirstInsightReport.shared";

type AuditEventRow = Pick<
  DatabaseSchema["app"]["Tables"]["audit_events"]["Row"],
  | "actor_user_id"
  | "workspace_id"
  | "resource_id"
  | "metadata"
  | "created_at"
>;

type WorkspaceRow = Pick<
  DatabaseSchema["app"]["Tables"]["workspaces"]["Row"],
  "id" | "slug" | "name"
>;

function isoDaysAgo(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}

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
    (moistureConfidenceLevel !== "high" &&
      moistureConfidenceLevel !== "medium") ||
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

async function main() {
  loadWorkerEnv();
  const args = parseCliArgs();
  const asJson = readBooleanFlag(args, "json");
  const workspaceId = readStringFlag(args, "workspace-id");
  const workspaceSlug = readStringFlag(args, "workspace-slug");
  const lookbackDays = readNumberFlag(args, "days") ?? 7;
  const limit = readNumberFlag(args, "limit") ?? 200;
  const env = readAppEnv(process.env);

  if (workspaceId && workspaceSlug) {
    throw new Error("Provide only one of --workspace-id or --workspace-slug");
  }

  if (!env.supabase.enabled || !env.supabase.url || !env.supabase.serviceRoleKey) {
    throw new Error("Supabase runtime is not configured");
  }

  const client = createSupabaseDatabaseClient({
    url: env.supabase.url,
    serviceKey: env.supabase.serviceRoleKey,
  });

  let resolvedWorkspaceId = workspaceId ?? null;
  let resolvedWorkspaceSlug = workspaceSlug ?? null;

  if (resolvedWorkspaceSlug) {
    const workspace = requireSupabaseData(
      await client
        .from("workspaces")
        .select("id,slug,name")
        .eq("slug", resolvedWorkspaceSlug)
        .maybeSingle(),
      "previewFirstInsightReport.workspaceBySlug",
    ) as WorkspaceRow | null;

    if (!workspace) {
      throw new Error(`Workspace slug not found: ${resolvedWorkspaceSlug}`);
    }

    resolvedWorkspaceId = workspace.id;
    resolvedWorkspaceSlug = workspace.slug;
  }

  const lookbackIso = isoDaysAgo(lookbackDays);
  let auditQuery = client
    .from("audit_events")
    .select("actor_user_id,workspace_id,resource_id,metadata,created_at")
    .eq("action", "preview.first_insight_surfaced")
    .gte("created_at", lookbackIso)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (resolvedWorkspaceId) {
    auditQuery = auditQuery.eq("workspace_id", resolvedWorkspaceId);
  }

  const auditRows = requireSupabaseData(
    await auditQuery,
    "previewFirstInsightReport.auditEvents",
  ) as readonly AuditEventRow[];

  const events = auditRows
    .map((row) => toPreviewFirstInsightEvent(row))
    .filter((event): event is PreviewFirstInsightEvent => event != null);

  let workspaceName: string | null = null;
  if (resolvedWorkspaceId) {
    const workspace = requireSupabaseData(
      await client
        .from("workspaces")
        .select("id,slug,name")
        .eq("id", resolvedWorkspaceId)
        .maybeSingle(),
      "previewFirstInsightReport.workspaceById",
    ) as WorkspaceRow | null;

    if (workspace) {
      resolvedWorkspaceSlug = workspace.slug;
      workspaceName = workspace.name;
    }
  }

  const report = buildPreviewFirstInsightReport({
    generatedAt: new Date().toISOString(),
    workspaceFilter: resolvedWorkspaceId ?? resolvedWorkspaceSlug,
    workspaceId: resolvedWorkspaceId,
    workspaceSlug: resolvedWorkspaceSlug,
    lookbackDays,
    events,
  });

  if (asJson) {
    console.log(JSON.stringify({ ...report, workspaceName }, null, 2));
    return;
  }

  console.log(
    [
      `Generated: ${report.generatedAt}`,
      `Workspace: ${workspaceName ?? resolvedWorkspaceSlug ?? resolvedWorkspaceId ?? "all"}`,
      `Lookback: ${report.lookbackDays} day(s)`,
      `First insight events: ${report.eventCount}`,
      `Unique actors: ${report.uniqueActorCount}`,
      `Unique fields: ${report.uniqueFieldCount}`,
      `Allowlisted events: ${report.allowlistedEventCount}`,
      `Non-allowlisted events: ${report.nonAllowlistedEventCount}`,
      `Avg workspace comparisons: ${
        report.averageWorkspaceSummaryComparisonCount ?? "—"
      }`,
    ].join("\n"),
  );

  if (report.topFields.length > 0) {
    console.log("\nTop focus fields:");
    console.table(
      report.topFields.map((field) => ({
        field: field.fieldName,
        events: field.eventCount,
        actors: field.uniqueActorCount,
        allowlisted: field.allowlisted ? "yes" : "no",
        firstSeen: field.firstSeenAt,
        lastSeen: field.lastSeenAt,
      })),
    );
  }

  if (report.daily.length > 0) {
    console.log("\nDaily summary:");
    console.table(report.daily);
  }
}

void main().catch((error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : "Unknown preview first-insight report failure";
  console.error(`[worker-preview-first-insight-report] ${message}`);
  process.exitCode = 1;
});
