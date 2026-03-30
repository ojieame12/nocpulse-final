import { createServerRuntime } from "@fieldpulse/platform-runtime";
import { createSupabaseDatabaseClient } from "@fieldpulse/platform-db";
import type { ImageryProvider } from "@fieldpulse/module-imagery";
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

  const fields = fieldsResult.data ?? [];
  const fieldIds = fields.map((field) => field.id);

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

  const rasterRows = rastersResult.data ?? [];

  return fields.map((field) => {
    const opticalRows = rasterRows.filter((row) => row.field_id === field.id);
    const latest = opticalRows.reduce<string | null>(
      (current, row) =>
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
  const fieldId = readStringFlag(args, "field-id");
  const limit = readNumberFlag(args, "limit") ?? 25;
  const targetCount = readNumberFlag(args, "target-count") ?? 2;
  const windows = readNumberFlag(args, "windows") ?? 3;
  const stepDays = readNumberFlag(args, "step-days") ?? 30;
  const providers = readCsvFlag(args, "providers");

  if (!workspaceId) {
    throw new Error("[worker-optical-history-backfill] --workspace-id is required");
  }

  if (targetCount < 1) {
    throw new Error("[worker-optical-history-backfill] --target-count must be >= 1");
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

  const beforeRows = await loadFieldHistoryRows({
    client,
    workspaceId,
    fieldId,
    limit,
  });

  const targets = beforeRows.filter((row) => row.opticalObservationCount < targetCount);
  const runs: Array<{
    fieldId: string;
    fieldName: string;
    beforeOpticalObservationCount: number;
    afterOpticalObservationCount: number;
    requestedAtAnchors: readonly string[];
    results: Array<{
      requestedAt: string;
      status: string;
      note: string;
      providerKey: string | null;
      capturedAt: string | null;
      observedAt: string | null;
      cellCount: number | null;
    }>;
  }> = [];

  for (const target of targets) {
    const anchors = buildRequestedAtAnchors({
      latestOpticalObservedAt: target.latestOpticalObservedAt,
      windows,
      stepDays,
    });

    const results: Array<{
      requestedAt: string;
      status: string;
      note: string;
      providerKey: string | null;
      capturedAt: string | null;
      observedAt: string | null;
      cellCount: number | null;
    }> = [];

    for (const requestedAt of anchors) {
      const result = await runtime.services.imagery.syncLatestFieldImagery({
        workspaceId,
        fieldId: target.fieldId,
        requestedAt,
        providers: providerList,
        dryRun,
      });

      results.push({
        requestedAt,
        status: result.status,
        note: result.note,
        providerKey: result.capture?.providerKey ?? null,
        capturedAt: result.capture?.capturedAt ?? null,
        observedAt: result.materializedObservation?.observedAt ?? null,
        cellCount: result.materializedObservation?.cellCount ?? null,
      });
    }

    const afterRows = await loadFieldHistoryRows({
      client,
      workspaceId,
      fieldId: target.fieldId,
      limit: 1,
    });
    const after = afterRows[0];

    runs.push({
      fieldId: target.fieldId,
      fieldName: target.fieldName,
      beforeOpticalObservationCount: target.opticalObservationCount,
      afterOpticalObservationCount: after?.opticalObservationCount ?? target.opticalObservationCount,
      requestedAtAnchors: anchors,
      results,
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    workspaceId,
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
      `Workspace: ${workspaceId}`,
      `Providers: ${providerList.join(", ")}`,
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
