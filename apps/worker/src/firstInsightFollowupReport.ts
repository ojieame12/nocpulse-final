import { pathToFileURL } from "node:url";
import { createSupabaseDatabaseClient, type DatabaseSchema } from "@fieldpulse/platform-db";
import { createServerRuntime } from "@fieldpulse/platform-runtime";
import { buildFirstInsightFunnelReport } from "./firstInsightFunnelReport.shared";
import { buildLaunchVisibleReadinessReport } from "./launchVisibleReadinessReport";
import { runFieldQualityAudit } from "./fieldQualityAudit";
import { loadWorkerEnv } from "./runtime/loadEnv";
import { parseCliArgs, readBooleanFlag, readNumberFlag } from "./runtime/parseCliArgs";

type RequestAccessRow = DatabaseSchema["app"]["Tables"]["request_access_requests"]["Row"];
type AuditEventRow = DatabaseSchema["app"]["Tables"]["audit_events"]["Row"];

const WORKSPACE_FUNNEL_ACTIONS = [
  "request-access.granted",
  "field-import.batch_committed",
  "field.created",
  "field.reused",
  "preview.first_insight_surfaced",
] as const;

type FollowupLaunchVisibleSummary = {
  scopedFieldCount: number;
  readyCount: number;
  hasEnoughReadyFields: boolean;
};

export type FirstInsightFollowupRow = {
  requestId: string;
  email: string;
  farmName: string;
  workspaceId: string | null;
  grantedAt: string | null;
  firstFieldActivityAt: string | null;
  firstFieldActivityType: string | null;
  firstInsightAt: string | null;
  hoursSinceGrant: number | null;
  hoursSinceFirstFieldActivity: number | null;
  launchVisible: FollowupLaunchVisibleSummary | null;
  followupReason:
    | "grant-missing"
    | "field-activity-missing"
    | "launch-visible-weak"
    | "insight-missing";
  recommendedAction: string;
};

export type FirstInsightFollowupReport = {
  generatedAt: string;
  requestCount: number;
  followupCount: number;
  rows: FirstInsightFollowupRow[];
};

function hoursSince(value: string | null, nowIso: string) {
  if (!value) {
    return null;
  }

  const start = Date.parse(value);
  const end = Date.parse(nowIso);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return null;
  }

  return Number((((end - start) / (1000 * 60 * 60)) * 100).toFixed(2)) / 100;
}

export function buildFirstInsightFollowupReport(input: {
  generatedAt?: string;
  funnel: ReturnType<typeof buildFirstInsightFunnelReport>;
  launchVisibleByWorkspaceId: ReadonlyMap<string, FollowupLaunchVisibleSummary>;
}): FirstInsightFollowupReport {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const rows: FirstInsightFollowupRow[] = [];

  for (const row of input.funnel.rows) {
    if (row.firstInsightAt) {
      continue;
    }

    const launchVisible =
      row.workspaceId != null ? input.launchVisibleByWorkspaceId.get(row.workspaceId) ?? null : null;

    let followupReason: FirstInsightFollowupRow["followupReason"];
    let recommendedAction: string;

    if (!row.grantedAt || !row.workspaceId) {
      followupReason = "grant-missing";
      recommendedAction = "Verify request-access grant flow and workspace creation before follow-up.";
    } else if (!row.firstFieldActivityAt) {
      followupReason = "field-activity-missing";
      recommendedAction = "Run a guided add-field walkthrough and watch for intake or hydration dead-ends.";
    } else if (launchVisible && !launchVisible.hasEnoughReadyFields) {
      followupReason = "launch-visible-weak";
      recommendedAction = "Tighten launch-visible curation before asking the grower to revisit first insight.";
    } else {
      followupReason = "insight-missing";
      recommendedAction = "Inspect preview routing and run a real first-insight walkthrough on this workspace.";
    }

    rows.push({
      requestId: row.requestId,
      email: row.email,
      farmName: row.farmName,
      workspaceId: row.workspaceId,
      grantedAt: row.grantedAt,
      firstFieldActivityAt: row.firstFieldActivityAt,
      firstFieldActivityType: row.firstFieldActivityType,
      firstInsightAt: row.firstInsightAt,
      hoursSinceGrant: hoursSince(row.grantedAt, generatedAt),
      hoursSinceFirstFieldActivity: hoursSince(row.firstFieldActivityAt, generatedAt),
      launchVisible,
      followupReason,
      recommendedAction,
    });
  }

  rows.sort((left, right) => {
    const leftHours = left.hoursSinceGrant ?? -1;
    const rightHours = right.hoursSinceGrant ?? -1;
    return rightHours - leftHours;
  });

  return {
    generatedAt,
    requestCount: input.funnel.requestCount,
    followupCount: rows.length,
    rows,
  };
}

async function main() {
  loadWorkerEnv();
  const runtime = createServerRuntime(process.env);
  const args = parseCliArgs();
  const asJson = readBooleanFlag(args, "json");
  const days = readNumberFlag(args, "days") ?? 30;
  const limit = readNumberFlag(args, "limit") ?? 50;

  if (runtime.mode !== "supabase") {
    throw new Error("Supabase runtime is not configured");
  }

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const client = createSupabaseDatabaseClient({
    url: runtime.env.supabase.url!,
    serviceKey: runtime.env.supabase.serviceRoleKey!,
  });

  const requestsResult = await client
    .from("request_access_requests")
    .select("id, email, farm_name, status, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (requestsResult.error) {
    throw requestsResult.error;
  }

  const requests = ((requestsResult.data ?? []) as Pick<
    RequestAccessRow,
    "id" | "email" | "farm_name" | "status" | "created_at"
  >[]).map((row) => ({
    id: row.id,
    email: row.email,
    farmName: row.farm_name,
    status: row.status,
    createdAt: row.created_at,
  }));

  let auditEvents: Array<{
    action: string;
    workspaceId: string | null;
    resourceId: string | null;
    createdAt: string;
    metadata: unknown;
  }> = [];

  if (requests.length > 0) {
    const requestIds = requests.map((row) => row.id);
    const grantedResult = await client
      .from("audit_events")
      .select("action, workspace_id, resource_id, created_at, metadata")
      .eq("action", "request-access.granted")
      .in("resource_id", requestIds)
      .order("created_at", { ascending: true });

    if (grantedResult.error) {
      throw grantedResult.error;
    }

    const grantedEvents = (grantedResult.data ?? []) as Pick<
      AuditEventRow,
      "action" | "workspace_id" | "resource_id" | "created_at" | "metadata"
    >[];
    const workspaceIds = [
      ...new Set(
        grantedEvents
          .map((event) => event.workspace_id)
          .filter((workspaceId): workspaceId is string => typeof workspaceId === "string"),
      ),
    ];

    auditEvents = grantedEvents.map((row) => ({
      action: row.action,
      workspaceId: row.workspace_id,
      resourceId: row.resource_id,
      createdAt: row.created_at,
      metadata: row.metadata,
    }));

    if (workspaceIds.length > 0) {
      const workspaceEventsResult = await client
        .from("audit_events")
        .select("action, workspace_id, resource_id, created_at, metadata")
        .in("workspace_id", workspaceIds)
        .in(
          "action",
          [...WORKSPACE_FUNNEL_ACTIONS].filter((action) => action !== "request-access.granted"),
        )
        .gte("created_at", since)
        .order("created_at", { ascending: true });

      if (workspaceEventsResult.error) {
        throw workspaceEventsResult.error;
      }

      auditEvents.push(
        ...((workspaceEventsResult.data ?? []) as Pick<
          AuditEventRow,
          "action" | "workspace_id" | "resource_id" | "created_at" | "metadata"
        >[]).map((row) => ({
          action: row.action,
          workspaceId: row.workspace_id,
          resourceId: row.resource_id,
          createdAt: row.created_at,
          metadata: row.metadata,
        })),
      );
    }
  }

  const funnel = buildFirstInsightFunnelReport({
    requests,
    auditEvents,
  });

  const workspaceIds = [
    ...new Set(
      funnel.rows
        .map((row) => row.workspaceId)
        .filter((workspaceId): workspaceId is string => Boolean(workspaceId)),
    ),
  ];

  const launchVisibleByWorkspaceId = new Map<string, FollowupLaunchVisibleSummary>();

  for (const workspaceId of workspaceIds) {
    const audit = await runFieldQualityAudit({
      client,
      workspaceId,
      lookbackDays: 45,
    });
    const report = buildLaunchVisibleReadinessReport({
      workspaceId: audit.workspaceId,
      workspaceSlug: audit.workspaceSlug,
      workspaceName: audit.fields[0]?.workspaceName ?? null,
      fields: audit.fields,
    });
    launchVisibleByWorkspaceId.set(workspaceId, {
      scopedFieldCount: report.scopedFieldCount,
      readyCount: report.readyCount,
      hasEnoughReadyFields: report.hasEnoughReadyFields,
    });
  }

  const report = buildFirstInsightFollowupReport({
    generatedAt: new Date().toISOString(),
    funnel,
    launchVisibleByWorkspaceId,
  });

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(
    [
      `Generated: ${report.generatedAt}`,
      `Requests scanned: ${report.requestCount}`,
      `Follow-up rows: ${report.followupCount}`,
    ].join("\n"),
  );

  console.table(
    report.rows.map((row) => ({
      email: row.email,
      farm: row.farmName,
      workspaceId: row.workspaceId ?? "",
      hoursSinceGrant: row.hoursSinceGrant ?? "",
      firstFieldActivity: row.firstFieldActivityType ?? "",
      launchVisibleReady: row.launchVisible ? `${row.launchVisible.readyCount}/${row.launchVisible.scopedFieldCount}` : "",
      followupReason: row.followupReason,
      recommendedAction: row.recommendedAction,
    })),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : "Unknown first insight follow-up failure";
    console.error(`[worker-first-insight-followup] ${message}`);
    process.exitCode = 1;
  });
}
