import { createSupabaseDatabaseClient, type DatabaseSchema } from "@fieldpulse/platform-db";
import { createServerRuntime } from "@fieldpulse/platform-runtime";
import {
  buildFirstInsightFunnelReport,
  type RequestAccessFunnelAuditRow,
  type RequestAccessFunnelSourceRow,
} from "./firstInsightFunnelReport.shared";
import { loadWorkerEnv } from "./runtime/loadEnv";
import {
  parseCliArgs,
  readBooleanFlag,
  readNumberFlag,
} from "./runtime/parseCliArgs";

type RequestAccessRow = DatabaseSchema["app"]["Tables"]["request_access_requests"]["Row"];
type AuditEventRow = DatabaseSchema["app"]["Tables"]["audit_events"]["Row"];

const WORKSPACE_FUNNEL_ACTIONS = [
  "request-access.granted",
  "field-import.batch_committed",
  "field.created",
  "field.reused",
  "preview.first_insight_surfaced",
] as const;

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

  const requestRows = (requestsResult.data ?? []) as Pick<
    RequestAccessRow,
    "id" | "email" | "farm_name" | "status" | "created_at"
  >[];

  const requests: RequestAccessFunnelSourceRow[] = requestRows.map((row) => ({
    id: row.id,
    email: row.email,
    farmName: row.farm_name,
    status: row.status,
    createdAt: row.created_at,
  }));

  let auditEvents: RequestAccessFunnelAuditRow[] = [];

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
    const workspaceIds = [...new Set(
      grantedEvents
        .map((event) => event.workspace_id)
        .filter((workspaceId): workspaceId is string => typeof workspaceId === "string"),
    )];

    const workspaceEvents: RequestAccessFunnelAuditRow[] = grantedEvents.map((row) => ({
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
        .in("action", [...WORKSPACE_FUNNEL_ACTIONS].filter((action) => action !== "request-access.granted"))
        .gte("created_at", since)
        .order("created_at", { ascending: true });

      if (workspaceEventsResult.error) {
        throw workspaceEventsResult.error;
      }

      workspaceEvents.push(
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

    auditEvents = workspaceEvents;
  }

  const report = buildFirstInsightFunnelReport({
    requests,
    auditEvents,
  });

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(
    [
      `Generated: ${report.generatedAt}`,
      `Window: last ${days} day(s)`,
      `Requests: ${report.requestCount}`,
      `Granted: ${report.grantedCount}`,
      `Field activity started: ${report.firstFieldActivityCount}`,
      `First insight reached: ${report.firstInsightCount}`,
      `Avg hours to grant: ${report.averageHoursToGrant ?? "n/a"}`,
      `Avg hours to first field activity: ${report.averageHoursToFirstFieldActivity ?? "n/a"}`,
      `Avg hours to first insight: ${report.averageHoursToFirstInsight ?? "n/a"}`,
    ].join("\n"),
  );

  console.table(
    report.rows.map((row) => ({
      submitted: row.submittedAt,
      email: row.email,
      farm: row.farmName,
      status: row.requestStatus,
      granted: row.grantedAt ?? "",
      workspaceId: row.workspaceId ?? "",
      firstFieldActivity: row.firstFieldActivityType ?? "",
      firstFieldAt: row.firstFieldActivityAt ?? "",
      firstInsightAt: row.firstInsightAt ?? "",
      reachedFirstInsight: row.reachedFirstInsight ? "yes" : "no",
    })),
  );
}

void main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Unknown first insight funnel report failure";
  console.error(`[worker-first-insight-funnel] ${message}`);
  process.exitCode = 1;
});
