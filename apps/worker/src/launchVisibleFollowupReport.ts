import { pathToFileURL } from "node:url";
import { readAppEnv } from "@fieldpulse/platform-config";
import { createSupabaseDatabaseClient } from "@fieldpulse/platform-db";
import {
  buildLaunchVisibleReadinessReport,
  type LaunchVisibleReadinessReport,
} from "./launchVisibleReadinessReport";
import { runFieldQualityAudit } from "./fieldQualityAudit";
import { loadWorkerEnv } from "./runtime/loadEnv";
import {
  parseCliArgs,
  readBooleanFlag,
  readNumberFlag,
  readStringFlag,
} from "./runtime/parseCliArgs";

type LaunchVisibleFollowupRow = {
  fieldId: string;
  fieldName: string;
  quality: LaunchVisibleReadinessReport["rows"][number]["quality"];
  allowlisted: boolean;
  reasons: readonly string[];
  nextAction: string;
};

export type LaunchVisibleFollowupReport = {
  generatedAt: string;
  workspaceId: string | null;
  workspaceSlug: string | null;
  workspaceName: string | null;
  scopedFieldCount: number;
  readyCount: number;
  weakFieldCount: number;
  hasEnoughReadyFields: boolean;
  minimumReadyFieldsRequired: number;
  missingReadyFieldCount: number;
  topBlockers: Array<{
    reason: string;
    count: number;
  }>;
  nextAction: string;
  rows: LaunchVisibleFollowupRow[];
};

function qualityRank(
  quality: LaunchVisibleReadinessReport["rows"][number]["quality"],
) {
  switch (quality) {
    case "broken":
      return 0;
    case "fallback":
      return 1;
    case "thin":
      return 2;
    case "ready":
      return 3;
  }
}

function chooseNextAction(row: LaunchVisibleReadinessReport["rows"][number]) {
  if (row.quality === "ready") {
    return "Keep this field in the launch-visible set.";
  }
  if (row.reasons.includes("synthetic-raster")) {
    return "Rebuild imagery and moisture context before using this field in first impressions.";
  }
  if (row.reasons.includes("seeded-fallback") || row.reasons.includes("missing-soil-context")) {
    return "Verify soil and moisture context, then rerun hydration before using this field.";
  }
  if (row.reasons.includes("vegetation-empty")) {
    return "Wait for a usable clear optical capture before using this field in launch-visible summaries.";
  }
  if (row.reasons.includes("vegetation-thin")) {
    return "Hold this field until at least one more usable optical capture is available.";
  }
  if (row.reasons.includes("moisture-history-empty") || row.reasons.includes("moisture-history-thin")) {
    return "Wait for more moisture history before using this field in first-insight comparisons.";
  }
  if (row.reasons.includes("low-confidence")) {
    return "Hold this field until a higher-confidence moisture snapshot is available.";
  }
  return "Keep this field out of the launch-visible set until its data quality reaches Ready.";
}

export function buildLaunchVisibleFollowupReport(input: {
  generatedAt?: string;
  readiness: LaunchVisibleReadinessReport;
}): LaunchVisibleFollowupReport {
  const weakRows = input.readiness.rows.filter((row) => row.quality !== "ready");
  const blockerCounts = new Map<string, number>();
  for (const row of weakRows) {
    for (const reason of row.reasons) {
      blockerCounts.set(reason, (blockerCounts.get(reason) ?? 0) + 1);
    }
  }

  const rows = [...input.readiness.rows]
    .sort((left, right) => {
      const qualityDelta = qualityRank(left.quality) - qualityRank(right.quality);
      if (qualityDelta !== 0) {
        return qualityDelta;
      }

      const leftRank = left.allowlistRank ?? Number.POSITIVE_INFINITY;
      const rightRank = right.allowlistRank ?? Number.POSITIVE_INFINITY;
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      return left.fieldName.localeCompare(right.fieldName);
    })
    .map<LaunchVisibleFollowupRow>((row) => ({
      fieldId: row.fieldId,
      fieldName: row.fieldName,
      quality: row.quality,
      allowlisted: row.allowlisted,
      reasons: row.reasons,
      nextAction: chooseNextAction(row),
    }));

  const missingReadyFieldCount = Math.max(
    0,
    input.readiness.minimumReadyFieldsRequired - input.readiness.readyCount,
  );

  const nextAction =
    input.readiness.hasEnoughReadyFields
      ? "Launch-visible field set is strong enough; keep monitoring weak fields outside the ready set."
      : input.readiness.allowlistConfigured
        ? `Promote or replace at least ${missingReadyFieldCount} launch-visible field(s) before outreach.`
        : `Find at least ${missingReadyFieldCount} ready field(s) before using this workspace for first impressions.`;

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    workspaceId: input.readiness.workspaceId,
    workspaceSlug: input.readiness.workspaceSlug,
    workspaceName: input.readiness.workspaceName,
    scopedFieldCount: input.readiness.scopedFieldCount,
    readyCount: input.readiness.readyCount,
    weakFieldCount: weakRows.length,
    hasEnoughReadyFields: input.readiness.hasEnoughReadyFields,
    minimumReadyFieldsRequired: input.readiness.minimumReadyFieldsRequired,
    missingReadyFieldCount,
    topBlockers: [...blockerCounts.entries()]
      .sort((left, right) => {
        if (right[1] !== left[1]) {
          return right[1] - left[1];
        }
        return left[0].localeCompare(right[0]);
      })
      .slice(0, 5)
      .map(([reason, count]) => ({ reason, count })),
    nextAction,
    rows,
  };
}

async function main() {
  loadWorkerEnv();
  const args = parseCliArgs();
  const asJson = readBooleanFlag(args, "json");
  const workspaceId = readStringFlag(args, "workspace-id");
  const workspaceSlug = readStringFlag(args, "workspace-slug");
  const limit = readNumberFlag(args, "limit");
  const lookbackDays = readNumberFlag(args, "days") ?? 45;
  const env = readAppEnv(process.env);

  if (!env.supabase.enabled || !env.supabase.url || !env.supabase.serviceRoleKey) {
    throw new Error("Supabase runtime is not configured");
  }

  const client = createSupabaseDatabaseClient({
    url: env.supabase.url,
    serviceKey: env.supabase.serviceRoleKey,
  });

  const audit = await runFieldQualityAudit({
    client,
    workspaceId,
    workspaceSlug,
    limit,
    lookbackDays,
  });

  const readiness = buildLaunchVisibleReadinessReport({
    workspaceId: audit.workspaceId,
    workspaceSlug: audit.workspaceSlug,
    workspaceName: audit.fields[0]?.workspaceName ?? null,
    fields: audit.fields,
  });

  const report = buildLaunchVisibleFollowupReport({ readiness });

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(
    [
      `Generated: ${report.generatedAt}`,
      `Workspace: ${report.workspaceName ?? report.workspaceSlug ?? report.workspaceId ?? "unknown"}`,
      `Scoped fields: ${report.scopedFieldCount}`,
      `Ready fields: ${report.readyCount}`,
      `Enough ready fields: ${report.hasEnoughReadyFields ? "yes" : "no"} (need ${report.minimumReadyFieldsRequired})`,
      `Next action: ${report.nextAction}`,
    ].join("\n"),
  );

  if (report.topBlockers.length > 0) {
    console.log("\nTop blockers:");
    console.table(report.topBlockers);
  }

  console.log("\nField follow-up:");
  console.table(
    report.rows.map((row) => ({
      field: row.fieldName,
      quality: row.quality,
      allowlisted: row.allowlisted ? "yes" : "no",
      reasons: row.reasons.slice(0, 3).join(", "),
      nextAction: row.nextAction,
    })),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : "Unknown launch-visible follow-up failure";
    console.error(`[worker-launch-visible-followup] ${message}`);
    process.exitCode = 1;
  });
}
