import { createServerRuntime } from "@fieldpulse/platform-runtime";
import {
  createSupabaseDatabaseClient,
  type DatabaseSchema,
} from "@fieldpulse/platform-db";
import type { ImageryProvider } from "@fieldpulse/module-imagery";
import {
  runFieldQualityAudit,
  type FieldQualityRow,
  type FieldQualityState,
} from "./fieldQualityAudit";
import { loadWorkerEnv } from "./runtime/loadEnv";
import {
  parseCliArgs,
  readBooleanFlag,
  readCsvFlag,
  readNumberFlag,
  readStringFlag,
} from "./runtime/parseCliArgs";

type FieldHistoryRow = {
  fieldId: string;
  fieldName: string;
  opticalObservationCount: number;
  latestOpticalObservedAt: string | null;
};

type FieldIndexRow = Pick<
  DatabaseSchema["app"]["Tables"]["fields"]["Row"],
  "id" | "name"
>;

type RasterObservationIndexRow = Pick<
  DatabaseSchema["app"]["Tables"]["field_raster_observations"]["Row"],
  "field_id" | "provider_key" | "observed_at"
>;

function elapsedMs(startedAt: number) {
  return Date.now() - startedAt;
}

function logProgress(message: string) {
  console.error(`[worker-optical-history-backfill] ${message}`);
}

function qualityRank(state: FieldQualityState) {
  switch (state) {
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

function shiftDays(iso: string, days: number) {
  const value = new Date(iso);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString();
}

function buildRequestedAtAnchors(input: {
  latestOpticalObservedAt: string | null;
  windows: number;
  stepDays: number;
}) {
  const anchors: string[] = [];
  const base = input.latestOpticalObservedAt
    ? shiftDays(input.latestOpticalObservedAt, 1)
    : new Date().toISOString();

  for (let index = 0; index < input.windows; index += 1) {
    anchors.push(shiftDays(base, index * input.stepDays));
  }

  return anchors;
}

async function loadFieldHistoryRows(input: {
  client: ReturnType<typeof createSupabaseDatabaseClient>;
  workspaceId: string;
  fieldId?: string;
  limit: number;
}) {
  let fieldQuery = input.client
    .from("fields")
    .select("id, name")
    .eq("workspace_id", input.workspaceId)
    .order("name", { ascending: true })
    .limit(input.limit);

  if (input.fieldId) {
    fieldQuery = fieldQuery.eq("id", input.fieldId);
  }

  const fieldsResult = await fieldQuery;
  if (fieldsResult.error) {
    throw fieldsResult.error;
  }

  const fields = (fieldsResult.data ?? []) as readonly FieldIndexRow[];
  const fieldIds = fields.map((field: FieldIndexRow) => field.id);

  if (fieldIds.length === 0) {
    return [] satisfies FieldHistoryRow[];
  }

  const rastersResult = await input.client
    .from("field_raster_observations")
    .select("field_id, provider_key, observed_at")
    .eq("workspace_id", input.workspaceId)
    .in("field_id", fieldIds)
    .in("provider_key", ["sentinel-2", "planet"]);

  if (rastersResult.error) {
    throw rastersResult.error;
  }

  const rasterRows = (rastersResult.data ?? []) as readonly RasterObservationIndexRow[];

  return fields.map((field: FieldIndexRow) => {
    const opticalRows = rasterRows.filter(
      (row: RasterObservationIndexRow) => row.field_id === field.id,
    );
    const latest = opticalRows.reduce<string | null>(
      (current, row: RasterObservationIndexRow) =>
        current === null || row.observed_at > current ? row.observed_at : current,
      null,
    );

    return {
      fieldId: field.id,
      fieldName: field.name,
      opticalObservationCount: opticalRows.length,
      latestOpticalObservedAt: latest,
    };
  });
}

async function main() {
  loadWorkerEnv();
  const runtime = createServerRuntime(process.env);
  const args = parseCliArgs();
  const asJson = readBooleanFlag(args, "json");
  const dryRun = readBooleanFlag(args, "dry-run");
  const workspaceId = readStringFlag(args, "workspace-id");
  const workspaceSlug = readStringFlag(args, "workspace-slug");
  const fieldId = readStringFlag(args, "field-id");
  const maxFields = readNumberFlag(args, "max-fields") ?? readNumberFlag(args, "limit") ?? 25;
  const targetCount = readNumberFlag(args, "target-count") ?? 2;
  const minOpticalCount = readNumberFlag(args, "min-optical-count") ?? 0;
  const windows = readNumberFlag(args, "windows") ?? 3;
  const stepDays = readNumberFlag(args, "step-days") ?? 30;
  const lookbackDays = readNumberFlag(args, "lookback-days") ?? 45;
  const providers = readCsvFlag(args, "providers");
  const qualities = readCsvFlag(args, "qualities");

  if (!workspaceId && !workspaceSlug) {
    throw new Error("[worker-optical-history-backfill] --workspace-id or --workspace-slug is required");
  }

  if (workspaceId && workspaceSlug) {
    throw new Error("[worker-optical-history-backfill] provide only one of --workspace-id or --workspace-slug");
  }

  if (targetCount < 1) {
    throw new Error("[worker-optical-history-backfill] --target-count must be >= 1");
  }

  if (minOpticalCount < 0) {
    throw new Error("[worker-optical-history-backfill] --min-optical-count must be >= 0");
  }

  if (windows < 1) {
    throw new Error("[worker-optical-history-backfill] --windows must be >= 1");
  }

  if (stepDays < 1) {
    throw new Error("[worker-optical-history-backfill] --step-days must be >= 1");
  }

  if (runtime.mode !== "supabase") {
    throw new Error("Supabase runtime is not configured");
  }

  const client = createSupabaseDatabaseClient({
    url: runtime.env.supabase.url!,
    serviceKey: runtime.env.supabase.serviceRoleKey!,
  });

  const providerList: readonly ImageryProvider[] =
    providers.length > 0
      ? providers.filter(
          (provider): provider is ImageryProvider =>
            provider === "sentinel-2" ||
            provider === "planet" ||
            provider === "sentinel-1",
        )
      : ["sentinel-2", "planet"];

  const targetedQualities: readonly FieldQualityState[] =
    qualities.length > 0
      ? qualities.filter(
          (quality): quality is FieldQualityState =>
            quality === "ready" ||
            quality === "thin" ||
            quality === "fallback" ||
            quality === "broken",
        )
      : ["thin", "fallback", "broken"];

  const audit =
    fieldId == null
      ? await runFieldQualityAudit({
          client,
          workspaceId,
          workspaceSlug,
          lookbackDays,
        })
      : null;

  const resolvedWorkspaceId = audit?.workspaceId ?? workspaceId ?? null;

  if (!resolvedWorkspaceId) {
    throw new Error("[worker-optical-history-backfill] could not resolve workspace id");
  }

  const targets: Array<
    Pick<FieldQualityRow, "fieldId" | "fieldName" | "opticalObservationCount" | "latestOpticalObservedAt" | "quality">
  > =
    fieldId != null
      ? (await loadFieldHistoryRows({
          client,
          workspaceId: resolvedWorkspaceId,
          fieldId,
          limit: 1,
        })).map((row: FieldHistoryRow) => ({
          fieldId: row.fieldId,
          fieldName: row.fieldName,
          opticalObservationCount: row.opticalObservationCount,
          latestOpticalObservedAt: row.latestOpticalObservedAt,
          quality: row.opticalObservationCount >= targetCount ? "ready" : "thin",
        }))
      : (audit?.fields ?? [])
          .filter(
            (
              row: Pick<
                FieldQualityRow,
                "fieldId" | "fieldName" | "opticalObservationCount" | "latestOpticalObservedAt" | "quality" | "vegetationReadiness"
              >,
            ) =>
              targetedQualities.includes(row.quality) &&
              row.vegetationReadiness !== "ready" &&
              row.opticalObservationCount >= minOpticalCount &&
              row.opticalObservationCount < targetCount,
          )
          .sort((left, right) => {
            const qualityDelta = qualityRank(left.quality) - qualityRank(right.quality);
            if (qualityDelta !== 0) {
              return qualityDelta;
            }
            if (left.opticalObservationCount !== right.opticalObservationCount) {
              return left.opticalObservationCount - right.opticalObservationCount;
            }
            if (left.latestOpticalObservedAt == null && right.latestOpticalObservedAt != null) {
              return -1;
            }
            if (left.latestOpticalObservedAt != null && right.latestOpticalObservedAt == null) {
              return 1;
            }
            if (
              left.latestOpticalObservedAt != null &&
              right.latestOpticalObservedAt != null &&
              left.latestOpticalObservedAt !== right.latestOpticalObservedAt
            ) {
              return left.latestOpticalObservedAt.localeCompare(right.latestOpticalObservedAt);
            }
            return left.fieldName.localeCompare(right.fieldName);
          })
          .slice(0, maxFields);

  logProgress(
    `targeted ${targets.length} field(s) in ${audit?.workspaceSlug ?? resolvedWorkspaceId} with qualities [${targetedQualities.join(", ")}], target optical count ${targetCount}`,
  );

  const runs: Array<{
    fieldId: string;
    fieldName: string;
    quality: FieldQualityState;
    elapsedMs: number;
    beforeOpticalObservationCount: number;
    afterOpticalObservationCount: number;
    requestedAtAnchors: readonly string[];
    results: Array<{
      requestedAt: string;
      elapsedMs: number;
      status: string;
      note: string;
      providerKey: string | null;
      capturedAt: string | null;
      observedAt: string | null;
      cellCount: number | null;
    }>;
  }> = [];

  for (const [targetIndex, target] of targets.entries()) {
    const fieldStartedAt = Date.now();
    logProgress(
      `field ${targetIndex + 1}/${targets.length}: ${target.fieldName} (${target.fieldId}) quality=${target.quality} optical=${target.opticalObservationCount}`,
    );

    const anchors = buildRequestedAtAnchors({
      latestOpticalObservedAt: target.latestOpticalObservedAt,
      windows,
      stepDays,
    });

    const results: Array<{
      requestedAt: string;
      elapsedMs: number;
      status: string;
      note: string;
      providerKey: string | null;
      capturedAt: string | null;
      observedAt: string | null;
      cellCount: number | null;
    }> = [];

    for (const [anchorIndex, requestedAt] of anchors.entries()) {
      const requestStartedAt = Date.now();
      logProgress(
        `field ${targetIndex + 1}/${targets.length} window ${anchorIndex + 1}/${anchors.length}: syncing ${target.fieldName} at ${requestedAt}`,
      );

      const result = await runtime.services.imagery.syncLatestFieldImagery({
        workspaceId: resolvedWorkspaceId,
        fieldId: target.fieldId,
        requestedAt,
        providers: providerList,
        dryRun,
      });

      results.push({
        requestedAt,
        elapsedMs: elapsedMs(requestStartedAt),
        status: result.status,
        note: result.note,
        providerKey: result.capture?.providerKey ?? null,
        capturedAt: result.capture?.capturedAt ?? null,
        observedAt: result.materializedObservation?.observedAt ?? null,
        cellCount: result.materializedObservation?.cellCount ?? null,
      });

      logProgress(
        `field ${targetIndex + 1}/${targets.length} window ${anchorIndex + 1}/${anchors.length}: ${result.status} provider=${result.capture?.providerKey ?? "none"} observedAt=${result.materializedObservation?.observedAt ?? "none"} elapsed=${elapsedMs(requestStartedAt)}ms`,
      );
    }

    const afterRows = await loadFieldHistoryRows({
      client,
      workspaceId: resolvedWorkspaceId,
      fieldId: target.fieldId,
      limit: 1,
    });
    const after = afterRows[0];

    runs.push({
      fieldId: target.fieldId,
      fieldName: target.fieldName,
      quality: target.quality,
      elapsedMs: elapsedMs(fieldStartedAt),
      beforeOpticalObservationCount: target.opticalObservationCount,
      afterOpticalObservationCount: after?.opticalObservationCount ?? target.opticalObservationCount,
      requestedAtAnchors: anchors,
      results,
    });

    logProgress(
      `field ${targetIndex + 1}/${targets.length}: ${target.fieldName} optical ${target.opticalObservationCount} -> ${after?.opticalObservationCount ?? target.opticalObservationCount} in ${elapsedMs(fieldStartedAt)}ms`,
    );
  }

  const report = {
    generatedAt: new Date().toISOString(),
    workspaceId: resolvedWorkspaceId,
    workspaceSlug: audit?.workspaceSlug ?? workspaceSlug ?? null,
    lookbackDays,
    targetedQualities,
    targetCount,
    windows,
    stepDays,
    dryRun,
    providers: providerList,
    targetedFieldCount: targets.length,
    runs,
  };

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(
    [
      `Generated: ${report.generatedAt}`,
      `Workspace: ${report.workspaceSlug ?? report.workspaceId}`,
      `Providers: ${providerList.join(", ")}`,
      `Lookback days: ${lookbackDays}`,
      `Target qualities: ${targetedQualities.join(", ")}`,
      `Target optical count: ${targetCount}`,
      `Windows per field: ${windows}`,
      `Step days: ${stepDays}`,
      `Dry run: ${dryRun}`,
      `Targeted fields: ${targets.length}`,
    ].join("\n"),
  );

  if (runs.length === 0) {
    console.log("\nNo fields required optical history backfill.");
    return;
  }

  console.table(
    runs.map((run) => ({
      field: run.fieldName,
      quality: run.quality,
      elapsedMs: run.elapsedMs,
      before: run.beforeOpticalObservationCount,
      after: run.afterOpticalObservationCount,
      delta: run.afterOpticalObservationCount - run.beforeOpticalObservationCount,
      latestStatus: run.results[0]?.status ?? "",
      latestProvider: run.results[0]?.providerKey ?? "",
      latestObservedAt: run.results[0]?.observedAt ?? "",
    })),
  );
}

void main().catch((error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : "Unknown optical history backfill failure";
  console.error(`[worker-optical-history-backfill] ${message}`);
  process.exitCode = 1;
});
