import { pathToFileURL } from "node:url";
import { readAppEnv } from "@fieldpulse/platform-config";
import { createSupabaseDatabaseClient } from "@fieldpulse/platform-db";
import {
  runFieldQualityAudit,
  type FieldQualityAuditReport,
  type FieldQualityRow,
} from "./fieldQualityAudit";
import { getWorkspaceFirstInsightAllowlist } from "./previewFirstInsightReport.shared";
import { loadWorkerEnv } from "./runtime/loadEnv";
import {
  parseCliArgs,
  readBooleanFlag,
  readNumberFlag,
  readStringFlag,
} from "./runtime/parseCliArgs";

type LaunchVisibleReadinessRow = Pick<
  FieldQualityRow,
  | "fieldId"
  | "fieldName"
  | "quality"
  | "reasons"
  | "vegetationReadiness"
  | "moistureReadiness"
  | "latestConfidence"
  | "derivationMode"
  | "rasterMode"
  | "signalBlend"
  | "latestMoistureObservedAt"
> & {
  allowlisted: boolean;
  allowlistRank: number | null;
};

export type LaunchVisibleReadinessReport = {
  generatedAt: string;
  workspaceId: string | null;
  workspaceSlug: string | null;
  workspaceName: string | null;
  allowlistConfigured: boolean;
  allowlistFieldCount: number;
  scopedFieldCount: number;
  readyCount: number;
  thinCount: number;
  fallbackCount: number;
  brokenCount: number;
  readyShare: number | null;
  hasEnoughReadyFields: boolean;
  minimumReadyFieldsRequired: number;
  rows: LaunchVisibleReadinessRow[];
};

function normalizeFieldName(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? null;
}

export function buildLaunchVisibleReadinessReport(input: {
  generatedAt?: string;
  workspaceId: string | null;
  workspaceSlug: string | null;
  workspaceName?: string | null;
  fields: readonly FieldQualityRow[];
}): LaunchVisibleReadinessReport {
  const allowlist = getWorkspaceFirstInsightAllowlist(input.workspaceId);
  const allowlistIndex = new Map(
    (allowlist ?? []).map((fieldName, index) => [normalizeFieldName(fieldName), index] as const),
  );

  const scopedRows = input.fields
    .map<LaunchVisibleReadinessRow>((field) => {
      const allowlistRank =
        allowlistIndex.get(normalizeFieldName(field.fieldName) ?? "__missing__") ?? null;

      return {
        fieldId: field.fieldId,
        fieldName: field.fieldName,
        quality: field.quality,
        reasons: field.reasons,
        vegetationReadiness: field.vegetationReadiness,
        moistureReadiness: field.moistureReadiness,
        latestConfidence: field.latestConfidence,
        derivationMode: field.derivationMode,
        rasterMode: field.rasterMode,
        signalBlend: field.signalBlend,
        latestMoistureObservedAt: field.latestMoistureObservedAt,
        allowlisted: allowlistRank != null,
        allowlistRank,
      };
    })
    .filter((field) => {
      if (!allowlist || allowlist.length === 0) {
        return true;
      }

      return field.allowlisted;
    })
    .sort((left, right) => {
      const leftRank = left.allowlistRank ?? Number.POSITIVE_INFINITY;
      const rightRank = right.allowlistRank ?? Number.POSITIVE_INFINITY;
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      const qualityRank = {
        ready: 3,
        thin: 2,
        fallback: 1,
        broken: 0,
      } as const;
      const scoreDelta = qualityRank[right.quality] - qualityRank[left.quality];
      if (scoreDelta !== 0) {
        return scoreDelta;
      }

      return left.fieldName.localeCompare(right.fieldName);
    });

  const readyCount = scopedRows.filter((row) => row.quality === "ready").length;
  const thinCount = scopedRows.filter((row) => row.quality === "thin").length;
  const fallbackCount = scopedRows.filter((row) => row.quality === "fallback").length;
  const brokenCount = scopedRows.filter((row) => row.quality === "broken").length;
  const minimumReadyFieldsRequired = allowlist && allowlist.length > 0 ? 2 : 1;

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    workspaceId: input.workspaceId,
    workspaceSlug: input.workspaceSlug,
    workspaceName: input.workspaceName ?? null,
    allowlistConfigured: Boolean(allowlist && allowlist.length > 0),
    allowlistFieldCount: allowlist?.length ?? 0,
    scopedFieldCount: scopedRows.length,
    readyCount,
    thinCount,
    fallbackCount,
    brokenCount,
    readyShare: scopedRows.length > 0 ? readyCount / scopedRows.length : null,
    hasEnoughReadyFields: readyCount >= minimumReadyFieldsRequired,
    minimumReadyFieldsRequired,
    rows: scopedRows,
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

  const workspaceName = audit.fields[0]?.workspaceName ?? null;
  const report = buildLaunchVisibleReadinessReport({
    workspaceId: audit.workspaceId,
    workspaceSlug: audit.workspaceSlug,
    workspaceName,
    fields: audit.fields,
  });

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(
    [
      `Generated: ${report.generatedAt}`,
      `Workspace: ${report.workspaceName ?? report.workspaceSlug ?? report.workspaceId ?? "unknown"}`,
      `Allowlist configured: ${report.allowlistConfigured ? "yes" : "no"}`,
      `Launch-visible fields: ${report.scopedFieldCount}`,
      `Ready fields: ${report.readyCount}`,
      `Enough ready fields: ${report.hasEnoughReadyFields ? "yes" : "no"} (need ${report.minimumReadyFieldsRequired})`,
    ].join("\n"),
  );

  console.table(
    report.rows.map((row) => ({
      field: row.fieldName,
      quality: row.quality,
      allowlisted: row.allowlisted ? "yes" : "no",
      vegetation: row.vegetationReadiness,
      moisture: row.moistureReadiness,
      confidence: row.latestConfidence ?? "",
      derivation: row.derivationMode ?? "",
      raster: row.rasterMode ?? "",
      reasons: row.reasons.slice(0, 3).join(", "),
    })),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : "Unknown launch-visible readiness failure";
    console.error(`[worker-launch-visible-readiness] ${message}`);
    process.exitCode = 1;
  });
}
