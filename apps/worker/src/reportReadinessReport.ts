import { createServerRuntime } from "@fieldpulse/platform-runtime";
import { createSupabaseDatabaseClient } from "@fieldpulse/platform-db";
import { loadWorkerEnv } from "./runtime/loadEnv";
import {
  parseCliArgs,
  readBooleanFlag,
  readNumberFlag,
  readStringFlag,
} from "./runtime/parseCliArgs";

type ChartReadiness = "ready" | "thin" | "empty";

interface FieldReadinessRow {
  fieldId: string;
  fieldName: string;
  opticalCaptureCount: number;
  sarCaptureCount: number;
  opticalObservationCount: number;
  sarObservationCount: number;
  vegetationReadiness: ChartReadiness;
  moistureReadiness: ChartReadiness;
  findings: number;
  zones: number;
  latestOpticalObservedAt: string | null;
  latestSarObservedAt: string | null;
}

function classifyReadiness(count: number): ChartReadiness {
  if (count >= 2) {
    return "ready";
  }
  if (count === 1) {
    return "thin";
  }
  return "empty";
}

async function main() {
  loadWorkerEnv();
  const runtime = createServerRuntime(process.env);
  const args = parseCliArgs();
  const asJson = readBooleanFlag(args, "json");
  const workspaceId = readStringFlag(args, "workspace-id");
  const limit = readNumberFlag(args, "limit") ?? 25;
  const fieldId = readStringFlag(args, "field-id");

  if (!workspaceId) {
    throw new Error("[worker-report-readiness] --workspace-id is required");
  }

  if (runtime.mode !== "supabase") {
    throw new Error("Supabase runtime is not configured");
  }

  const client = createSupabaseDatabaseClient({
    url: runtime.env.supabase.url!,
    serviceKey: runtime.env.supabase.serviceRoleKey!,
  });

  let fieldQuery = client
    .from("fields")
    .select("id, name")
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true })
    .limit(limit);

  if (fieldId) {
    fieldQuery = fieldQuery.eq("id", fieldId);
  }

  const fieldsResult = await fieldQuery;

  if (fieldsResult.error) {
    throw fieldsResult.error;
  }

  const fields = fieldsResult.data ?? [];
  const fieldIds = fields.map((field) => field.id);

  if (fieldIds.length === 0) {
    const empty = {
      generatedAt: new Date().toISOString(),
      workspaceId,
      fieldCount: 0,
      rows: [] as FieldReadinessRow[],
    };
    console.log(JSON.stringify(empty, null, 2));
    return;
  }

  const [capturesResult, rastersResult, findingsResult, zonesResult] = await Promise.all([
    client
      .from("field_imagery_captures")
      .select("field_id, provider_key, captured_at")
      .eq("workspace_id", workspaceId)
      .in("field_id", fieldIds)
      .in("provider_key", ["sentinel-1", "sentinel-2", "planet"]),
    client
      .from("field_raster_observations")
      .select("field_id, provider_key, observed_at")
      .eq("workspace_id", workspaceId)
      .in("field_id", fieldIds)
      .in("provider_key", ["sentinel-1", "sentinel-2", "planet"]),
    client
      .from("field_intelligence_findings")
      .select("field_id")
      .eq("workspace_id", workspaceId)
      .eq("status", "active")
      .in("field_id", fieldIds),
    client
      .from("field_intelligence_zones")
      .select("field_id")
      .eq("workspace_id", workspaceId)
      .in("field_id", fieldIds),
  ]);

  if (capturesResult.error) throw capturesResult.error;
  if (rastersResult.error) throw rastersResult.error;
  if (findingsResult.error) throw findingsResult.error;
  if (zonesResult.error) throw zonesResult.error;

  const captureRows = capturesResult.data ?? [];
  const rasterRows = rastersResult.data ?? [];
  const findingRows = findingsResult.data ?? [];
  const zoneRows = zonesResult.data ?? [];

  const captureSummary = new Map<
    string,
    {
      opticalCount: number;
      sarCount: number;
    }
  >();
  for (const row of captureRows) {
    const existing = captureSummary.get(row.field_id) ?? {
      opticalCount: 0,
      sarCount: 0,
    };
    if (row.provider_key === "sentinel-1") {
      existing.sarCount += 1;
    } else {
      existing.opticalCount += 1;
    }
    captureSummary.set(row.field_id, existing);
  }

  const rasterSummary = new Map<
    string,
    {
      opticalCount: number;
      sarCount: number;
      latestOpticalObservedAt: string | null;
      latestSarObservedAt: string | null;
    }
  >();
  for (const row of rasterRows) {
    const existing = rasterSummary.get(row.field_id) ?? {
      opticalCount: 0,
      sarCount: 0,
      latestOpticalObservedAt: null,
      latestSarObservedAt: null,
    };

    if (row.provider_key === "sentinel-1") {
      existing.sarCount += 1;
      if (!existing.latestSarObservedAt || row.observed_at > existing.latestSarObservedAt) {
        existing.latestSarObservedAt = row.observed_at;
      }
    } else {
      existing.opticalCount += 1;
      if (!existing.latestOpticalObservedAt || row.observed_at > existing.latestOpticalObservedAt) {
        existing.latestOpticalObservedAt = row.observed_at;
      }
    }

    rasterSummary.set(row.field_id, existing);
  }

  const activeFindingCount = new Map<string, number>();
  for (const row of findingRows) {
    activeFindingCount.set(row.field_id, (activeFindingCount.get(row.field_id) ?? 0) + 1);
  }

  const zoneCount = new Map<string, number>();
  for (const row of zoneRows) {
    zoneCount.set(row.field_id, (zoneCount.get(row.field_id) ?? 0) + 1);
  }

  const rows: FieldReadinessRow[] = fields.map((field) => {
    const captures = captureSummary.get(field.id) ?? { opticalCount: 0, sarCount: 0 };
    const rasters = rasterSummary.get(field.id) ?? {
      opticalCount: 0,
      sarCount: 0,
      latestOpticalObservedAt: null,
      latestSarObservedAt: null,
    };

    return {
      fieldId: field.id,
      fieldName: field.name,
      opticalCaptureCount: captures.opticalCount,
      sarCaptureCount: captures.sarCount,
      opticalObservationCount: rasters.opticalCount,
      sarObservationCount: rasters.sarCount,
      vegetationReadiness: classifyReadiness(rasters.opticalCount),
      moistureReadiness: classifyReadiness(rasters.sarCount),
      findings: activeFindingCount.get(field.id) ?? 0,
      zones: zoneCount.get(field.id) ?? 0,
      latestOpticalObservedAt: rasters.latestOpticalObservedAt,
      latestSarObservedAt: rasters.latestSarObservedAt,
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    workspaceId,
    fieldCount: rows.length,
    rows,
  };

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(
    [
      `Generated: ${report.generatedAt}`,
      `Workspace: ${workspaceId}`,
      `Fields scanned: ${report.fieldCount}`,
    ].join("\n"),
  );

  console.table(
    rows.map((row) => ({
      field: row.fieldName,
      optical: `${row.opticalObservationCount} obs / ${row.opticalCaptureCount} cap`,
      sar: `${row.sarObservationCount} obs / ${row.sarCaptureCount} cap`,
      vegetation: row.vegetationReadiness,
      moisture: row.moistureReadiness,
      findings: row.findings,
      zones: row.zones,
      latestOptical: row.latestOpticalObservedAt ?? "",
      latestSar: row.latestSarObservedAt ?? "",
    })),
  );
}

void main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Unknown report readiness failure";
  console.error(`[worker-report-readiness] ${message}`);
  process.exitCode = 1;
});
