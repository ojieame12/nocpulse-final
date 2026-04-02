import { pathToFileURL } from "node:url";
import { createSupabaseDatabaseClient, type DatabaseSchema } from "@fieldpulse/platform-db";
import { createServerRuntime } from "@fieldpulse/platform-runtime";
import { loadWorkerEnv } from "./runtime/loadEnv";
import {
  parseCliArgs,
  readBooleanFlag,
  readNumberFlag,
  readStringFlag,
} from "./runtime/parseCliArgs";

type WorkspaceRow = Pick<
  DatabaseSchema["app"]["Tables"]["workspaces"]["Row"],
  "id" | "slug" | "name"
>;

type ActionBriefAlertRow = Pick<
  DatabaseSchema["app"]["Tables"]["field_alerts"]["Row"],
  | "workspace_id"
  | "field_id"
  | "status"
  | "started_at"
  | "acknowledged_at"
  | "resolved_at"
  | "created_at"
  | "title"
>;

export type ActionBriefReviewWorkspaceSummary = {
  workspaceId: string;
  workspaceSlug: string | null;
  workspaceName: string | null;
  alertCount: number;
  activeCount: number;
  resolvedCount: number;
  dismissedCount: number;
  acknowledgedCount: number;
  unacknowledgedActiveCount: number;
  averageHoursToAcknowledge: number | null;
  averageHoursToResolution: number | null;
  dismissalRate: number | null;
  resolutionRate: number | null;
};

export type ActionBriefReviewReport = {
  generatedAt: string;
  workspaceFilter: string | null;
  lookbackDays: number;
  workspaceCount: number;
  summaries: ActionBriefReviewWorkspaceSummary[];
};

export type ActionBriefReviewAggregate = {
  workspaceCount: number;
  alertCount: number;
  activeCount: number;
  resolvedCount: number;
  dismissedCount: number;
  acknowledgedCount: number;
  unacknowledgedActiveCount: number;
  averageHoursToAcknowledge: number | null;
  averageHoursToResolution: number | null;
  dismissalRate: number | null;
  resolutionRate: number | null;
};

function average(values: readonly number[]) {
  if (values.length === 0) {
    return null;
  }

  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function hoursBetween(startIso: string | null, endIso: string | null) {
  if (!startIso || !endIso) {
    return null;
  }

  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return null;
  }

  return (end - start) / (1000 * 60 * 60);
}

export function buildActionBriefReviewReport(input: {
  generatedAt?: string;
  workspaceFilter?: string | null;
  lookbackDays: number;
  workspaces: readonly WorkspaceRow[];
  alerts: readonly ActionBriefAlertRow[];
}): ActionBriefReviewReport {
  const workspaceById = new Map(input.workspaces.map((workspace) => [workspace.id, workspace]));
  const alertsByWorkspace = new Map<string, ActionBriefAlertRow[]>();

  for (const alert of input.alerts) {
    const bucket = alertsByWorkspace.get(alert.workspace_id) ?? [];
    bucket.push(alert);
    alertsByWorkspace.set(alert.workspace_id, bucket);
  }

  const summaries = [...alertsByWorkspace.entries()]
    .map<ActionBriefReviewWorkspaceSummary>(([workspaceId, alerts]) => {
      const workspace = workspaceById.get(workspaceId) ?? null;
      const activeCount = alerts.filter((alert) => alert.status === "active").length;
      const resolvedCount = alerts.filter((alert) => alert.status === "resolved").length;
      const dismissedCount = alerts.filter((alert) => alert.status === "dismissed").length;
      const acknowledgedCount = alerts.filter((alert) => alert.acknowledged_at != null).length;
      const unacknowledgedActiveCount = alerts.filter(
        (alert) => alert.status === "active" && alert.acknowledged_at == null,
      ).length;

      const acknowledgementDurations = alerts
        .map((alert) => hoursBetween(alert.started_at, alert.acknowledged_at))
        .filter((value): value is number => value != null);
      const resolutionDurations = alerts
        .map((alert) => hoursBetween(alert.started_at, alert.resolved_at))
        .filter((value): value is number => value != null);

      return {
        workspaceId,
        workspaceSlug: workspace?.slug ?? null,
        workspaceName: workspace?.name ?? null,
        alertCount: alerts.length,
        activeCount,
        resolvedCount,
        dismissedCount,
        acknowledgedCount,
        unacknowledgedActiveCount,
        averageHoursToAcknowledge: average(acknowledgementDurations),
        averageHoursToResolution: average(resolutionDurations),
        dismissalRate: alerts.length > 0 ? Number((dismissedCount / alerts.length).toFixed(4)) : null,
        resolutionRate: alerts.length > 0 ? Number((resolvedCount / alerts.length).toFixed(4)) : null,
      };
    })
    .sort((left, right) => {
      if (right.dismissedCount !== left.dismissedCount) {
        return right.dismissedCount - left.dismissedCount;
      }

      if (right.unacknowledgedActiveCount !== left.unacknowledgedActiveCount) {
        return right.unacknowledgedActiveCount - left.unacknowledgedActiveCount;
      }

      return (left.workspaceName ?? left.workspaceSlug ?? left.workspaceId).localeCompare(
        right.workspaceName ?? right.workspaceSlug ?? right.workspaceId,
      );
    });

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    workspaceFilter: input.workspaceFilter ?? null,
    lookbackDays: input.lookbackDays,
    workspaceCount: summaries.length,
    summaries,
  };
}

export function summarizeActionBriefReviewAlerts(
  alerts: readonly ActionBriefAlertRow[],
): ActionBriefReviewAggregate {
  const acknowledgementDurations = alerts
    .map((alert) => hoursBetween(alert.started_at, alert.acknowledged_at))
    .filter((value): value is number => value != null);
  const resolutionDurations = alerts
    .map((alert) => hoursBetween(alert.started_at, alert.resolved_at))
    .filter((value): value is number => value != null);

  const workspaceIds = new Set(
    alerts
      .map((alert) => alert.workspace_id)
      .filter((workspaceId): workspaceId is string => typeof workspaceId === "string"),
  );

  const activeCount = alerts.filter((alert) => alert.status === "active").length;
  const resolvedCount = alerts.filter((alert) => alert.status === "resolved").length;
  const dismissedCount = alerts.filter((alert) => alert.status === "dismissed").length;
  const acknowledgedCount = alerts.filter((alert) => alert.acknowledged_at != null).length;
  const unacknowledgedActiveCount = alerts.filter(
    (alert) => alert.status === "active" && alert.acknowledged_at == null,
  ).length;

  return {
    workspaceCount: workspaceIds.size,
    alertCount: alerts.length,
    activeCount,
    resolvedCount,
    dismissedCount,
    acknowledgedCount,
    unacknowledgedActiveCount,
    averageHoursToAcknowledge: average(acknowledgementDurations),
    averageHoursToResolution: average(resolutionDurations),
    dismissalRate: alerts.length > 0 ? Number((dismissedCount / alerts.length).toFixed(4)) : null,
    resolutionRate: alerts.length > 0 ? Number((resolvedCount / alerts.length).toFixed(4)) : null,
  };
}

async function main() {
  loadWorkerEnv();
  const runtime = createServerRuntime(process.env);
  const args = parseCliArgs();
  const asJson = readBooleanFlag(args, "json");
  const workspaceId = readStringFlag(args, "workspace-id");
  const workspaceSlug = readStringFlag(args, "workspace-slug");
  const lookbackDays = readNumberFlag(args, "days") ?? 30;

  if (runtime.mode !== "supabase") {
    throw new Error("Supabase runtime is not configured");
  }

  if (workspaceId && workspaceSlug) {
    throw new Error("Provide only one of --workspace-id or --workspace-slug");
  }

  const client = createSupabaseDatabaseClient({
    url: runtime.env.supabase.url!,
    serviceKey: runtime.env.supabase.serviceRoleKey!,
  });

  let resolvedWorkspaceId = workspaceId ?? null;
  let resolvedWorkspaceSlug = workspaceSlug ?? null;

  if (resolvedWorkspaceSlug) {
    const workspaceResult = await client
      .from("workspaces")
      .select("id,slug,name")
      .eq("slug", resolvedWorkspaceSlug)
      .maybeSingle();

    if (workspaceResult.error) {
      throw workspaceResult.error;
    }
    if (!workspaceResult.data) {
      throw new Error(`Workspace slug not found: ${resolvedWorkspaceSlug}`);
    }

    resolvedWorkspaceId = workspaceResult.data.id;
    resolvedWorkspaceSlug = workspaceResult.data.slug;
  }

  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();

  let alertsQuery = client
    .from("field_alerts")
    .select("workspace_id,field_id,status,started_at,acknowledged_at,resolved_at,created_at,title")
    .eq("family", "action_brief")
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  if (resolvedWorkspaceId) {
    alertsQuery = alertsQuery.eq("workspace_id", resolvedWorkspaceId);
  }

  const alertsResult = await alertsQuery;
  if (alertsResult.error) {
    throw alertsResult.error;
  }

  const alerts = (alertsResult.data ?? []) as readonly ActionBriefAlertRow[];
  const workspaceIds = [
    ...new Set(
      alerts
        .map((alert) => alert.workspace_id)
        .filter((workspaceId): workspaceId is string => typeof workspaceId === "string"),
    ),
  ];

  const workspaces =
    workspaceIds.length === 0
      ? []
      : ((await client
          .from("workspaces")
          .select("id,slug,name")
          .in("id", workspaceIds)
          .then((result) => {
            if (result.error) throw result.error;
            return result.data ?? [];
          })) as readonly WorkspaceRow[]);

  const report = buildActionBriefReviewReport({
    generatedAt: new Date().toISOString(),
    workspaceFilter: resolvedWorkspaceId ?? resolvedWorkspaceSlug,
    lookbackDays,
    workspaces,
    alerts,
  });

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(
    [
      `Generated: ${report.generatedAt}`,
      `Workspace filter: ${report.workspaceFilter ?? "all"}`,
      `Lookback: ${report.lookbackDays} day(s)`,
      `Workspaces: ${report.workspaceCount}`,
    ].join("\n"),
  );

  console.table(
    report.summaries.map((summary) => ({
      workspace: summary.workspaceName ?? summary.workspaceSlug ?? summary.workspaceId,
      alerts: summary.alertCount,
      active: summary.activeCount,
      resolved: summary.resolvedCount,
      dismissed: summary.dismissedCount,
      acknowledged: summary.acknowledgedCount,
      unacknowledgedActive: summary.unacknowledgedActiveCount,
      avgHoursToAck: summary.averageHoursToAcknowledge ?? "",
      avgHoursToResolve: summary.averageHoursToResolution ?? "",
    })),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown action brief review failure";
    console.error(`[worker-action-brief-review] ${message}`);
    process.exitCode = 1;
  });
}
