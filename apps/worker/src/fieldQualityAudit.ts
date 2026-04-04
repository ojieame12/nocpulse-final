import type { MoistureInputProvenance } from "@fieldpulse/module-moisture";
import { pathToFileURL } from "node:url";
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

type ChartReadiness = "ready" | "thin" | "empty";
export type FieldQualityState = "ready" | "thin" | "fallback" | "broken";
export type FieldQualityReason =
  | "missing-moisture-snapshot"
  | "missing-weather-observation"
  | "missing-raster-observation"
  | "missing-soil-context"
  | "seeded-fallback"
  | "synthetic-raster"
  | "vegetation-thin"
  | "vegetation-empty"
  | "moisture-history-thin"
  | "moisture-history-empty"
  | "low-confidence";

type FieldRow = Pick<
  DatabaseSchema["app"]["Tables"]["fields"]["Row"],
  "id" | "name" | "workspace_id"
>;

type WorkspaceRow = Pick<
  DatabaseSchema["app"]["Tables"]["workspaces"]["Row"],
  "id" | "slug" | "name"
>;

type RasterRow = Pick<
  DatabaseSchema["app"]["Tables"]["field_raster_observations"]["Row"],
  "field_id" | "provider_key" | "observed_at"
>;

type WeatherObservationRow = Pick<
  DatabaseSchema["app"]["Tables"]["field_weather_observations"]["Row"],
  "field_id" | "observed_at"
>;

type MoistureSnapshotRow = Pick<
  DatabaseSchema["app"]["Tables"]["field_moisture_snapshots"]["Row"],
  "field_id" | "observed_at" | "confidence" | "inputs" | "source_key"
>;

export interface FieldQualityRow {
  workspaceId: string;
  workspaceSlug: string | null;
  workspaceName: string | null;
  fieldId: string;
  fieldName: string;
  quality: FieldQualityState;
  reasons: readonly FieldQualityReason[];
  vegetationReadiness: ChartReadiness;
  moistureReadiness: ChartReadiness;
  opticalObservationCount: number;
  sarObservationCount: number;
  weatherObservationCount: number;
  moistureSnapshotCount: number;
  sourceBackedMoistureSnapshotCount: number;
  latestOpticalObservedAt: string | null;
  latestSarObservedAt: string | null;
  latestWeatherObservedAt: string | null;
  latestMoistureObservedAt: string | null;
  latestConfidence: "low" | "medium" | "high" | "unknown" | null;
  latestSourceKey: string | null;
  derivationMode: "source-backed" | "seeded-range" | "context-only" | null;
  rasterMode: "provider" | "synthetic" | "none" | "optical-context" | null;
  signalBlend: "raster+weather" | "raster-only" | "weather-only" | "seeded" | null;
  hasSoilContext: boolean;
  usedOptical: boolean;
  usedSar: boolean;
  usedWeather: boolean;
  usedWeatherSoilMoisture: boolean;
  findings: number;
  zones: number;
}

type ClassificationInput = {
  hasMoistureSnapshot: boolean;
  hasWeatherObservation: boolean;
  hasRasterObservation: boolean;
  hasSoilContext: boolean;
  vegetationReadiness: ChartReadiness;
  moistureReadiness: ChartReadiness;
  derivationMode: "source-backed" | "seeded-range" | "context-only" | null;
  rasterMode: "provider" | "synthetic" | "none" | "optical-context" | null;
  signalBlend: "raster+weather" | "raster-only" | "weather-only" | "seeded" | null;
  confidence: "low" | "medium" | "high" | "unknown" | null;
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString<T extends string>(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? (value as T) : undefined;
}

function readBoolean(record: Record<string, unknown>, key: string) {
  return record[key] === true;
}

function readNumber(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function parseMoistureInputs(value: unknown): MoistureInputProvenance {
  if (!isPlainRecord(value)) {
    return {};
  }

  return {
    derivationMode: readString<"source-backed" | "seeded-range" | "context-only">(value, "derivationMode"),
    rasterMode: readString<"provider" | "synthetic" | "none" | "optical-context">(value, "rasterMode"),
    signalBlend: readString<"raster+weather" | "raster-only" | "weather-only" | "seeded">(
      value,
      "signalBlend",
    ),
    soilDataset: readString(value, "soilDataset"),
    baselineDataset: readString(value, "baselineDataset"),
    availableWaterMm: readNumber(value, "availableWaterMm"),
    fieldCapacityPct: readNumber(value, "fieldCapacityPct"),
    wiltingPointPct: readNumber(value, "wiltingPointPct"),
    rootZoneDepthCm: readNumber(value, "rootZoneDepthCm"),
    usedOptical: readBoolean(value, "usedOptical"),
    usedSar: readBoolean(value, "usedSar"),
    usedWeather: readBoolean(value, "usedWeather"),
    usedWeatherSoilMoisture: readBoolean(value, "usedWeatherSoilMoisture"),
  };
}

function hasSoilContext(inputs: MoistureInputProvenance) {
  return Boolean(
    inputs.soilDataset ||
      inputs.baselineDataset ||
      inputs.availableWaterMm != null ||
      inputs.fieldCapacityPct != null ||
      inputs.wiltingPointPct != null ||
      inputs.rootZoneDepthCm != null,
  );
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

export function classifyFieldQuality(input: ClassificationInput): {
  state: FieldQualityState;
  reasons: FieldQualityReason[];
} {
  const reasons: FieldQualityReason[] = [];

  if (!input.hasMoistureSnapshot) {
    reasons.push("missing-moisture-snapshot");
  }
  if (!input.hasWeatherObservation) {
    reasons.push("missing-weather-observation");
  }
  if (!input.hasRasterObservation) {
    reasons.push("missing-raster-observation");
  }
  if (!input.hasSoilContext) {
    reasons.push("missing-soil-context");
  }
  if (input.derivationMode === "seeded-range" || input.signalBlend === "seeded") {
    reasons.push("seeded-fallback");
  }
  if (input.rasterMode === "synthetic") {
    reasons.push("synthetic-raster");
  }
  if (input.vegetationReadiness === "thin") {
    reasons.push("vegetation-thin");
  }
  if (input.vegetationReadiness === "empty") {
    reasons.push("vegetation-empty");
  }
  if (input.moistureReadiness === "thin") {
    reasons.push("moisture-history-thin");
  }
  if (input.moistureReadiness === "empty") {
    reasons.push("moisture-history-empty");
  }
  if (input.confidence == null || input.confidence === "unknown" || input.confidence === "low") {
    reasons.push("low-confidence");
  }

  if (!input.hasMoistureSnapshot || (!input.hasWeatherObservation && !input.hasRasterObservation)) {
    return { state: "broken", reasons };
  }

  if (
    input.derivationMode === "seeded-range" ||
    input.derivationMode === "context-only" ||
    input.signalBlend === "seeded" ||
    input.rasterMode === "synthetic" ||
    input.rasterMode === "optical-context" ||
    !input.hasSoilContext
  ) {
    return { state: "fallback", reasons };
  }

  if (
    input.vegetationReadiness !== "ready" ||
    input.moistureReadiness !== "ready" ||
    input.confidence == null ||
    input.confidence === "unknown" ||
    input.confidence === "low"
  ) {
    return { state: "thin", reasons };
  }

  return { state: "ready", reasons };
}

function isoDaysAgo(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
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

export type FieldQualityAuditReport = {
  workspaceId: string | null;
  workspaceSlug: string | null;
  summary: {
    generatedAt: string;
    workspaceFilter: string | null;
    workspaceId: string | null;
    workspaceSlug: string | null;
    lookbackDays: number;
    fieldCount: number;
    readyCount: number;
    thinCount: number;
    fallbackCount: number;
    brokenCount: number;
    vegetationReadyCount: number;
    moistureReadyCount: number;
    sourceBackedLatestCount: number;
    seededFallbackCount: number;
    syntheticRasterCount: number;
    missingSoilContextCount: number;
    lowConfidenceCount: number;
    reasonCounts: Record<string, number>;
  };
  fields: FieldQualityRow[];
};

type RunFieldQualityAuditInput = {
  client: ReturnType<typeof createSupabaseDatabaseClient>;
  workspaceId?: string | null;
  workspaceSlug?: string | null;
  limit?: number;
  lookbackDays?: number;
};

export async function runFieldQualityAudit(
  input: RunFieldQualityAuditInput,
): Promise<FieldQualityAuditReport> {
  const lookbackDays = input.lookbackDays ?? 45;
  let resolvedWorkspaceId = input.workspaceId ?? null;
  let resolvedWorkspaceSlug = input.workspaceSlug ?? null;

  if (resolvedWorkspaceId && resolvedWorkspaceSlug) {
    throw new Error("Provide only one of workspaceId or workspaceSlug");
  }

  if (resolvedWorkspaceSlug) {
    const workspace = requireSupabaseData(
      await input.client
        .from("workspaces")
        .select("id,slug")
        .eq("slug", resolvedWorkspaceSlug)
        .maybeSingle(),
      "fieldQualityAudit.workspaceBySlug",
    ) as Pick<WorkspaceRow, "id" | "slug"> | null;

    if (!workspace) {
      throw new Error(`Workspace slug not found: ${resolvedWorkspaceSlug}`);
    }

    resolvedWorkspaceId = workspace.id;
    resolvedWorkspaceSlug = workspace.slug;
  }

  let fieldsQuery = input.client
    .from("fields")
    .select("id,name,workspace_id")
    .order("workspace_id", { ascending: true })
    .order("name", { ascending: true });

  if (resolvedWorkspaceId) {
    fieldsQuery = fieldsQuery.eq("workspace_id", resolvedWorkspaceId);
  }

  if (input.limit != null) {
    fieldsQuery = fieldsQuery.limit(input.limit);
  }

  const fields = requireSupabaseData(
    await fieldsQuery,
    "fieldQualityAudit.fields",
  ) as readonly FieldRow[];

  if (fields.length === 0) {
    return {
      workspaceId: resolvedWorkspaceId,
      workspaceSlug: resolvedWorkspaceSlug,
      summary: {
        generatedAt: new Date().toISOString(),
        workspaceFilter: resolvedWorkspaceId ?? resolvedWorkspaceSlug,
        workspaceId: resolvedWorkspaceId,
        workspaceSlug: resolvedWorkspaceSlug,
        lookbackDays,
        fieldCount: 0,
        readyCount: 0,
        thinCount: 0,
        fallbackCount: 0,
        brokenCount: 0,
        vegetationReadyCount: 0,
        moistureReadyCount: 0,
        sourceBackedLatestCount: 0,
        seededFallbackCount: 0,
        syntheticRasterCount: 0,
        missingSoilContextCount: 0,
        lowConfidenceCount: 0,
        reasonCounts: {},
      },
      fields: [],
    };
  }

  const workspaceIds = [...new Set(fields.map((field) => field.workspace_id))];
  const workspaces = requireSupabaseData(
    await input.client.from("workspaces").select("id,slug,name").in("id", workspaceIds),
    "fieldQualityAudit.workspaces",
  ) as readonly WorkspaceRow[];
  const workspaceById = new Map(workspaces.map((workspace) => [workspace.id, workspace]));

  const fieldIds = fields.map((field) => field.id);
  const lookbackIso = isoDaysAgo(lookbackDays);

  const [
    rasterRowsResult,
    weatherRowsResult,
    moistureRowsResult,
    findingsResult,
    zonesResult,
  ] = await Promise.all([
    input.client
      .from("field_raster_observations")
      .select("field_id,provider_key,observed_at")
      .in("field_id", fieldIds)
      .gte("observed_at", lookbackIso)
      .order("observed_at", { ascending: false }),
    input.client
      .from("field_weather_observations")
      .select("field_id,observed_at")
      .in("field_id", fieldIds)
      .gte("observed_at", lookbackIso)
      .order("observed_at", { ascending: false }),
    input.client
      .from("field_moisture_snapshots")
      .select("field_id,observed_at,confidence,inputs,source_key")
      .in("field_id", fieldIds)
      .gte("observed_at", lookbackIso)
      .order("observed_at", { ascending: false }),
    input.client
      .from("field_intelligence_findings")
      .select("field_id")
      .in("field_id", fieldIds)
      .eq("status", "active"),
    input.client
      .from("field_intelligence_zones")
      .select("field_id")
      .in("field_id", fieldIds),
  ]);

  if (rasterRowsResult.error) throw rasterRowsResult.error;
  if (weatherRowsResult.error) throw weatherRowsResult.error;
  if (moistureRowsResult.error) throw moistureRowsResult.error;
  if (findingsResult.error) throw findingsResult.error;
  if (zonesResult.error) throw zonesResult.error;

  const rasterRows = (rasterRowsResult.data ?? []) as readonly RasterRow[];
  const weatherRows = (weatherRowsResult.data ?? []) as readonly WeatherObservationRow[];
  const moistureRows = (moistureRowsResult.data ?? []) as readonly MoistureSnapshotRow[];
  const findingRows = findingsResult.data ?? [];
  const zoneRows = zonesResult.data ?? [];

  const rasterSummary = new Map<
    string,
    {
      opticalObservationCount: number;
      sarObservationCount: number;
      latestOpticalObservedAt: string | null;
      latestSarObservedAt: string | null;
    }
  >();

  for (const row of rasterRows) {
    const existing = rasterSummary.get(row.field_id) ?? {
      opticalObservationCount: 0,
      sarObservationCount: 0,
      latestOpticalObservedAt: null,
      latestSarObservedAt: null,
    };

    if (row.provider_key === "sentinel-1") {
      existing.sarObservationCount += 1;
      if (!existing.latestSarObservedAt || row.observed_at > existing.latestSarObservedAt) {
        existing.latestSarObservedAt = row.observed_at;
      }
    } else {
      existing.opticalObservationCount += 1;
      if (
        !existing.latestOpticalObservedAt ||
        row.observed_at > existing.latestOpticalObservedAt
      ) {
        existing.latestOpticalObservedAt = row.observed_at;
      }
    }

    rasterSummary.set(row.field_id, existing);
  }

  const weatherSummary = new Map<
    string,
    {
      weatherObservationCount: number;
      latestWeatherObservedAt: string | null;
    }
  >();

  for (const row of weatherRows) {
    const existing = weatherSummary.get(row.field_id) ?? {
      weatherObservationCount: 0,
      latestWeatherObservedAt: null,
    };
    existing.weatherObservationCount += 1;
    if (!existing.latestWeatherObservedAt || row.observed_at > existing.latestWeatherObservedAt) {
      existing.latestWeatherObservedAt = row.observed_at;
    }
    weatherSummary.set(row.field_id, existing);
  }

  const moistureSummary = new Map<
    string,
    {
      latestObservedAt: string | null;
      latestConfidence: "low" | "medium" | "high" | "unknown" | null;
      latestSourceKey: string | null;
      inputs: MoistureInputProvenance;
      moistureSnapshotCount: number;
      sourceBackedMoistureSnapshotCount: number;
    }
  >();

  for (const row of moistureRows) {
    const existing = moistureSummary.get(row.field_id) ?? {
      latestObservedAt: null,
      latestConfidence: null,
      latestSourceKey: null,
      inputs: {},
      moistureSnapshotCount: 0,
      sourceBackedMoistureSnapshotCount: 0,
    };
    const inputs = parseMoistureInputs(row.inputs);

    existing.moistureSnapshotCount += 1;
    if (inputs.derivationMode === "source-backed") {
      existing.sourceBackedMoistureSnapshotCount += 1;
    }

    if (!existing.latestObservedAt) {
      existing.latestObservedAt = row.observed_at;
      existing.latestConfidence =
        row.confidence === "low" ||
        row.confidence === "medium" ||
        row.confidence === "high" ||
        row.confidence === "unknown"
          ? row.confidence
          : null;
      existing.latestSourceKey = row.source_key;
      existing.inputs = inputs;
    }

    moistureSummary.set(row.field_id, existing);
  }

  const activeFindingCount = new Map<string, number>();
  for (const row of findingRows) {
    activeFindingCount.set(row.field_id, (activeFindingCount.get(row.field_id) ?? 0) + 1);
  }

  const zoneCount = new Map<string, number>();
  for (const row of zoneRows) {
    zoneCount.set(row.field_id, (zoneCount.get(row.field_id) ?? 0) + 1);
  }

  const rows: FieldQualityRow[] = fields.map((field) => {
    const workspace = workspaceById.get(field.workspace_id);
    const raster = rasterSummary.get(field.id) ?? {
      opticalObservationCount: 0,
      sarObservationCount: 0,
      latestOpticalObservedAt: null,
      latestSarObservedAt: null,
    };
    const weather = weatherSummary.get(field.id) ?? {
      weatherObservationCount: 0,
      latestWeatherObservedAt: null,
    };
    const moisture = moistureSummary.get(field.id) ?? {
      latestObservedAt: null,
      latestConfidence: null,
      latestSourceKey: null,
      inputs: {},
      moistureSnapshotCount: 0,
      sourceBackedMoistureSnapshotCount: 0,
    };

    const vegetationReadiness = classifyReadiness(raster.opticalObservationCount);
    const moistureReadiness = classifyReadiness(moisture.sourceBackedMoistureSnapshotCount);
    const classification = classifyFieldQuality({
      hasMoistureSnapshot: moisture.latestObservedAt != null,
      hasWeatherObservation: weather.weatherObservationCount > 0,
      hasRasterObservation:
        raster.opticalObservationCount > 0 || raster.sarObservationCount > 0,
      hasSoilContext: hasSoilContext(moisture.inputs),
      vegetationReadiness,
      moistureReadiness,
      derivationMode: moisture.inputs.derivationMode ?? null,
      rasterMode: moisture.inputs.rasterMode ?? null,
      signalBlend: moisture.inputs.signalBlend ?? null,
      confidence: moisture.latestConfidence,
    });

    return {
      workspaceId: field.workspace_id,
      workspaceSlug: workspace?.slug ?? null,
      workspaceName: workspace?.name ?? null,
      fieldId: field.id,
      fieldName: field.name,
      quality: classification.state,
      reasons: classification.reasons,
      vegetationReadiness,
      moistureReadiness,
      opticalObservationCount: raster.opticalObservationCount,
      sarObservationCount: raster.sarObservationCount,
      weatherObservationCount: weather.weatherObservationCount,
      moistureSnapshotCount: moisture.moistureSnapshotCount,
      sourceBackedMoistureSnapshotCount: moisture.sourceBackedMoistureSnapshotCount,
      latestOpticalObservedAt: raster.latestOpticalObservedAt,
      latestSarObservedAt: raster.latestSarObservedAt,
      latestWeatherObservedAt: weather.latestWeatherObservedAt,
      latestMoistureObservedAt: moisture.latestObservedAt,
      latestConfidence: moisture.latestConfidence,
      latestSourceKey: moisture.latestSourceKey,
      derivationMode: moisture.inputs.derivationMode ?? null,
      rasterMode: moisture.inputs.rasterMode ?? null,
      signalBlend: moisture.inputs.signalBlend ?? null,
      hasSoilContext: hasSoilContext(moisture.inputs),
      usedOptical: moisture.inputs.usedOptical === true,
      usedSar: moisture.inputs.usedSar === true,
      usedWeather: moisture.inputs.usedWeather === true,
      usedWeatherSoilMoisture: moisture.inputs.usedWeatherSoilMoisture === true,
      findings: activeFindingCount.get(field.id) ?? 0,
      zones: zoneCount.get(field.id) ?? 0,
    };
  });

  rows.sort((left, right) => {
    const qualityDelta = qualityRank(left.quality) - qualityRank(right.quality);
    if (qualityDelta !== 0) {
      return qualityDelta;
    }
    return left.fieldName.localeCompare(right.fieldName);
  });

  const reasonCounts = rows.reduce<Record<string, number>>((acc, row) => {
    for (const reason of row.reasons) {
      acc[reason] = (acc[reason] ?? 0) + 1;
    }
    return acc;
  }, {});

  const summary = {
    generatedAt: new Date().toISOString(),
    workspaceFilter: resolvedWorkspaceId ?? resolvedWorkspaceSlug ?? null,
    workspaceId: resolvedWorkspaceId,
    workspaceSlug: resolvedWorkspaceSlug,
    lookbackDays,
    fieldCount: rows.length,
    readyCount: rows.filter((row) => row.quality === "ready").length,
    thinCount: rows.filter((row) => row.quality === "thin").length,
    fallbackCount: rows.filter((row) => row.quality === "fallback").length,
    brokenCount: rows.filter((row) => row.quality === "broken").length,
    vegetationReadyCount: rows.filter((row) => row.vegetationReadiness === "ready").length,
    moistureReadyCount: rows.filter((row) => row.moistureReadiness === "ready").length,
    sourceBackedLatestCount: rows.filter((row) => row.derivationMode === "source-backed").length,
    seededFallbackCount: rows.filter((row) => row.derivationMode === "seeded-range").length,
    syntheticRasterCount: rows.filter((row) => row.rasterMode === "synthetic").length,
    missingSoilContextCount: rows.filter((row) => !row.hasSoilContext).length,
    lowConfidenceCount: rows.filter(
      (row) =>
        row.latestConfidence == null ||
        row.latestConfidence === "unknown" ||
        row.latestConfidence === "low",
    ).length,
    reasonCounts,
  };

  return {
    workspaceId: resolvedWorkspaceId,
    workspaceSlug: resolvedWorkspaceSlug,
    summary,
    fields: rows,
  };
}

async function main() {
  loadWorkerEnv();
  const args = parseCliArgs();
  const workspaceId = readStringFlag(args, "workspace-id");
  const workspaceSlug = readStringFlag(args, "workspace-slug");
  const limit = readNumberFlag(args, "limit");
  const lookbackDays = readNumberFlag(args, "lookback-days") ?? 45;
  const asJson = readBooleanFlag(args, "json");
  const env = readAppEnv(process.env);

  if (!env.supabase.enabled || !env.supabase.url || !env.supabase.serviceRoleKey) {
    throw new Error("Supabase runtime is not configured");
  }

  if (workspaceId && workspaceSlug) {
    throw new Error("Provide only one of --workspace-id or --workspace-slug");
  }

  const client = createSupabaseDatabaseClient({
    url: env.supabase.url,
    serviceKey: env.supabase.serviceRoleKey,
  });

  const report = await runFieldQualityAudit({
    client,
    workspaceId,
    workspaceSlug,
    limit,
    lookbackDays,
  });

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(
    [
      `Generated: ${report.summary.generatedAt}`,
      `Workspace filter: ${report.summary.workspaceFilter ?? "all"}`,
      `Lookback days: ${report.summary.lookbackDays}`,
      `Fields scanned: ${report.summary.fieldCount}`,
      `Ready: ${report.summary.readyCount}`,
      `Thin: ${report.summary.thinCount}`,
      `Fallback: ${report.summary.fallbackCount}`,
      `Broken: ${report.summary.brokenCount}`,
      `Vegetation ready: ${report.summary.vegetationReadyCount}`,
      `Moisture ready: ${report.summary.moistureReadyCount}`,
      `Latest source-backed moisture: ${report.summary.sourceBackedLatestCount}`,
      `Seeded fallback latest: ${report.summary.seededFallbackCount}`,
      `Synthetic raster latest: ${report.summary.syntheticRasterCount}`,
      `Missing soil context: ${report.summary.missingSoilContextCount}`,
      `Low/unknown confidence latest: ${report.summary.lowConfidenceCount}`,
    ].join("\n"),
  );

  if (report.fields.length > 0) {
    console.log("\nField quality");
    console.table(
      report.fields.slice(0, 60).map((row) => ({
        workspace: row.workspaceSlug ?? row.workspaceId,
        field: row.fieldName,
        quality: row.quality,
        reasons: row.reasons.join(", "),
        vegetation: `${row.vegetationReadiness} (${row.opticalObservationCount})`,
        moisture: `${row.moistureReadiness} (${row.sourceBackedMoistureSnapshotCount})`,
        confidence: row.latestConfidence ?? "",
        blend: row.signalBlend ?? "",
        soil: row.hasSoilContext ? "yes" : "no",
      })),
    );
  }

  const topReasons = Object.entries(report.summary.reasonCounts)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 10);

  if (topReasons.length > 0) {
    console.log("\nTop reasons");
    console.table(topReasons.map(([reason, count]) => ({ reason, count })));
  }
}

const isMainModule =
  process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  void main().catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : "Unknown field quality audit failure";
    console.error(`[worker-field-quality] ${message}`);
    process.exitCode = 1;
  });
}
