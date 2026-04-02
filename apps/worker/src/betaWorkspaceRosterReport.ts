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

type LaunchVisibleSnapshot = {
  scopedFieldCount: number;
  readyCount: number;
  hasEnoughReadyFields: boolean;
};

export type BetaWorkspaceRosterStatus =
  | "ready-for-outreach"
  | "needs-curation"
  | "needs-walkthrough"
  | "needs-intake"
  | "needs-grant";

export type BetaWorkspaceRosterRow = {
  requestId: string;
  email: string;
  farmName: string;
  workspaceId: string | null;
  grantedAt: string | null;
  firstFieldActivityAt: string | null;
  firstInsightAt: string | null;
  launchVisible: LaunchVisibleSnapshot | null;
  status: BetaWorkspaceRosterStatus;
  nextAction: string;
};

export type BetaWorkspaceRosterReport = {
  generatedAt: string;
  requestCount: number;
  rowCount: number;
  statusCounts: Record<BetaWorkspaceRosterStatus, number>;
  rows: BetaWorkspaceRosterRow[];
};

export function buildBetaWorkspaceRosterReport(input: {
  generatedAt?: string;
  funnel: ReturnType<typeof buildFirstInsightFunnelReport>;
  launchVisibleByWorkspaceId: ReadonlyMap<string, LaunchVisibleSnapshot>;
}): BetaWorkspaceRosterReport {
  const rows: BetaWorkspaceRosterRow[] = input.funnel.rows.map((row) => {
    const launchVisible =
      row.workspaceId != null ? input.launchVisibleByWorkspaceId.get(row.workspaceId) ?? null : null;

    let status: BetaWorkspaceRosterStatus;
    let nextAction: string;

    if (!row.grantedAt || !row.workspaceId) {
      status = "needs-grant";
      nextAction = "Grant access and confirm workspace creation.";
    } else if (!row.firstFieldActivityAt) {
      status = "needs-intake";
      nextAction = "Run an assisted add-field or import walkthrough.";
    } else if (launchVisible && !launchVisible.hasEnoughReadyFields) {
      status = "needs-curation";
      nextAction = "Tighten launch-visible field curation before outreach.";
    } else if (!row.firstInsightAt) {
      status = "needs-walkthrough";
      nextAction = "Run a first-insight walkthrough on the current workspace.";
    } else {
      status = "ready-for-outreach";
      nextAction = "Safe to include in the next controlled beta follow-up.";
    }

    return {
      requestId: row.requestId,
      email: row.email,
      farmName: row.farmName,
      workspaceId: row.workspaceId,
      grantedAt: row.grantedAt,
      firstFieldActivityAt: row.firstFieldActivityAt,
      firstInsightAt: row.firstInsightAt,
      launchVisible,
      status,
      nextAction,
    };
  });

  const statusCounts: BetaWorkspaceRosterReport["statusCounts"] = {
    "ready-for-outreach": 0,
    "needs-curation": 0,
    "needs-walkthrough": 0,
    "needs-intake": 0,
    "needs-grant": 0,
  };

  for (const row of rows) {
    statusCounts[row.status] += 1;
  }

  rows.sort((left, right) => {
    const rank = {
      "needs-grant": 0,
      "needs-intake": 1,
      "needs-curation": 2,
      "needs-walkthrough": 3,
      "ready-for-outreach": 4,
    } as const;
    const statusDelta = rank[left.status] - rank[right.status];
    if (statusDelta !== 0) {
      return statusDelta;
    }

    return (right.grantedAt ?? "").localeCompare(left.grantedAt ?? "");
  });

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    requestCount: input.funnel.requestCount,
    rowCount: rows.length,
    statusCounts,
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

  const launchVisibleByWorkspaceId = new Map<string, LaunchVisibleSnapshot>();
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

  const report = buildBetaWorkspaceRosterReport({
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
      `Workspace rows: ${report.rowCount}`,
    ].join("\n"),
  );

  console.table(
    report.rows.map((row) => ({
      email: row.email,
      farm: row.farmName,
      workspaceId: row.workspaceId ?? "",
      status: row.status,
      launchVisibleReady: row.launchVisible ? `${row.launchVisible.readyCount}/${row.launchVisible.scopedFieldCount}` : "",
      nextAction: row.nextAction,
    })),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown beta workspace roster failure";
    console.error(`[worker-beta-workspace-roster] ${message}`);
    process.exitCode = 1;
  });
}
