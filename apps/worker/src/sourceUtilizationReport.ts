import {
  createSupabaseFieldMoistureSnapshotRepository,
  type MoistureInputProvenance,
} from "@fieldpulse/module-moisture";
import {
  createSupabaseImageryCaptureRepository,
  type ImageryCapture,
} from "@fieldpulse/module-imagery";
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

type FieldOverviewRow = Pick<
  DatabaseSchema["app"]["Views"]["field_overview"]["Row"],
  "workspace_id" | "id" | "name"
>;

type WorkspaceRow = Pick<
  DatabaseSchema["app"]["Tables"]["workspaces"]["Row"],
  "id" | "slug" | "name"
>;

type LatestCaptureSet = {
  sentinel1: ImageryCapture | null;
  sentinel2: ImageryCapture | null;
  planet: ImageryCapture | null;
};

function isProviderInSource(
  sourceKey: string | undefined,
  provider: "sentinel-1" | "sentinel-2" | "planet",
) {
  const normalized = sourceKey?.toLowerCase() ?? "";
  return normalized.includes(provider);
}

function selectLatestCaptureByProvider(
  captures: readonly ImageryCapture[],
): LatestCaptureSet {
  let sentinel1: ImageryCapture | null = null;
  let sentinel2: ImageryCapture | null = null;
  let planet: ImageryCapture | null = null;

  for (const capture of captures) {
    if (!sentinel1 && capture.providerKey === "sentinel-1") {
      sentinel1 = capture;
    }
    if (!sentinel2 && capture.providerKey === "sentinel-2") {
      sentinel2 = capture;
    }
    if (!planet && capture.providerKey === "planet") {
      planet = capture;
    }

    if (sentinel1 && sentinel2 && planet) {
      break;
    }
  }

  return { sentinel1, sentinel2, planet };
}

function pushGap(gaps: string[], enabled: boolean, label: string) {
  if (enabled) {
    gaps.push(label);
  }
}

async function main() {
  loadWorkerEnv();
  const args = parseCliArgs();
  const workspaceId = readStringFlag(args, "workspace-id");
  const limit = readNumberFlag(args, "limit");
  const asJson = readBooleanFlag(args, "json");
  const env = readAppEnv(process.env);

  if (!env.supabase.enabled || !env.supabase.url || !env.supabase.serviceRoleKey) {
    throw new Error("Supabase runtime is not configured");
  }

  const client = createSupabaseDatabaseClient({
    url: env.supabase.url,
    serviceKey: env.supabase.serviceRoleKey,
  });
  const moistureSnapshots = createSupabaseFieldMoistureSnapshotRepository(client);
  const imageryCaptures = createSupabaseImageryCaptureRepository(client);

  let fieldsQuery = client
    .from("field_overview")
    .select("workspace_id,id,name")
    .order("workspace_id", { ascending: true })
    .order("name", { ascending: true });

  if (workspaceId) {
    fieldsQuery = fieldsQuery.eq("workspace_id", workspaceId);
  }

  if (limit != null) {
    fieldsQuery = fieldsQuery.limit(limit);
  }

  const fields = requireSupabaseData(
    await fieldsQuery,
    "sourceUtilizationReport.fields",
  ) as readonly FieldOverviewRow[];

  const workspaceIds = [...new Set(fields.map((field) => field.workspace_id))];
  const workspaces = workspaceIds.length === 0
    ? []
    : (requireSupabaseData(
        await client.from("workspaces").select("id,slug,name").in("id", workspaceIds),
        "sourceUtilizationReport.workspaces",
      ) as readonly WorkspaceRow[]);
  const workspaceById = new Map(workspaces.map((workspace) => [workspace.id, workspace]));

  const captureRows = await imageryCaptures.listRecent({
    workspaceId,
    limit: Math.max((limit ?? fields.length) * 20, 500),
  });
  const capturesByField = new Map<string, ImageryCapture[]>();

  for (const capture of captureRows) {
    const list = capturesByField.get(capture.fieldId) ?? [];
    list.push(capture);
    capturesByField.set(capture.fieldId, list);
  }

  const fieldReports = await Promise.all(
    fields.map(async (field) => {
      const snapshot = await moistureSnapshots.getLatestByField(
        field.workspace_id,
        field.id,
      );
      const inputs: MoistureInputProvenance = snapshot?.inputs ?? {};
      const latestCaptures = selectLatestCaptureByProvider(
        capturesByField.get(field.id) ?? [],
      );

      const usedPlanet =
        isProviderInSource(inputs.rasterSourceKey, "planet") ||
        isProviderInSource(inputs.soilDataset, "planet");
      const usedSentinel2 =
        isProviderInSource(inputs.rasterSourceKey, "sentinel-2") ||
        isProviderInSource(inputs.soilDataset, "sentinel-2");
      const usedSentinel1 =
        isProviderInSource(inputs.rasterSourceKey, "sentinel-1") ||
        isProviderInSource(inputs.sarDataset, "sentinel-1");
      const gaps: string[] = [];

      pushGap(gaps, snapshot == null, "missing-moisture-snapshot");
      pushGap(
        gaps,
        snapshot != null && !inputs.derivationMode,
        "legacy-provenance-missing",
      );
      pushGap(gaps, inputs.signalBlend === "seeded", "seeded-moisture");
      pushGap(gaps, inputs.rasterMode === "synthetic", "synthetic-raster");
      pushGap(
        gaps,
        Boolean(latestCaptures.planet) && !usedPlanet,
        "planet-captured-not-used",
      );
      pushGap(
        gaps,
        Boolean(latestCaptures.sentinel2) && !usedSentinel2,
        "sentinel2-captured-not-used",
      );
      pushGap(
        gaps,
        Boolean(latestCaptures.sentinel1) && !usedSentinel1,
        "sentinel1-captured-not-used",
      );
      pushGap(gaps, !inputs.baselineDataset, "baseline-missing");

      return {
        workspaceId: field.workspace_id,
        workspaceSlug: workspaceById.get(field.workspace_id)?.slug ?? null,
        workspaceName: workspaceById.get(field.workspace_id)?.name ?? null,
        fieldId: field.id,
        fieldName: field.name,
        moistureObservedAt: snapshot?.observedAt ?? null,
        moistureSourceKey: snapshot?.sourceKey ?? null,
        confidence: snapshot?.confidence ?? null,
        confidenceScore: inputs.confidenceScore ?? null,
        derivationMode: inputs.derivationMode ?? null,
        signalBlend: inputs.signalBlend ?? null,
        rasterMode: inputs.rasterMode ?? null,
        rasterSourceKey: inputs.rasterSourceKey ?? null,
        weatherSourceKey: inputs.weatherSourceKey ?? null,
        baselineDataset: inputs.baselineDataset ?? null,
        usedOptical: inputs.usedOptical ?? false,
        usedSar: inputs.usedSar ?? false,
        usedWeather: inputs.usedWeather ?? false,
        usedWeatherSoilMoisture: inputs.usedWeatherSoilMoisture ?? false,
        confidenceReason: inputs.confidenceReason ?? null,
        latestSentinel1CapturedAt: latestCaptures.sentinel1?.capturedAt ?? null,
        latestSentinel1Status: latestCaptures.sentinel1?.status ?? null,
        latestSentinel2CapturedAt: latestCaptures.sentinel2?.capturedAt ?? null,
        latestSentinel2Status: latestCaptures.sentinel2?.status ?? null,
        latestPlanetCapturedAt: latestCaptures.planet?.capturedAt ?? null,
        latestPlanetStatus: latestCaptures.planet?.status ?? null,
        gaps,
      };
    }),
  );

  const summary = {
    generatedAt: new Date().toISOString(),
    workspaceFilter: workspaceId ?? null,
    fieldCount: fieldReports.length,
    missingMoistureSnapshotCount: fieldReports.filter(
      (field) => field.moistureObservedAt == null,
    ).length,
    seededMoistureCount: fieldReports.filter(
      (field) => field.signalBlend === "seeded",
    ).length,
    syntheticRasterCount: fieldReports.filter(
      (field) => field.rasterMode === "synthetic",
    ).length,
    providerRasterCount: fieldReports.filter(
      (field) => field.rasterMode === "provider",
    ).length,
    rasterAndWeatherBlendCount: fieldReports.filter(
      (field) => field.signalBlend === "raster+weather",
    ).length,
    weatherOnlyCount: fieldReports.filter(
      (field) => field.signalBlend === "weather-only",
    ).length,
    fieldsWithSentinel1Captures: fieldReports.filter(
      (field) => field.latestSentinel1CapturedAt != null,
    ).length,
    fieldsWithSentinel2Captures: fieldReports.filter(
      (field) => field.latestSentinel2CapturedAt != null,
    ).length,
    fieldsWithPlanetCaptures: fieldReports.filter(
      (field) => field.latestPlanetCapturedAt != null,
    ).length,
    fieldsUsingSar: fieldReports.filter((field) => field.usedSar).length,
    fieldsUsingOptical: fieldReports.filter((field) => field.usedOptical).length,
    fieldsUsingWeather: fieldReports.filter((field) => field.usedWeather).length,
    fieldsUsingPlanet: fieldReports.filter(
      (field) => isProviderInSource(field.rasterSourceKey ?? undefined, "planet"),
    ).length,
    fieldsMissingBaselineDataset: fieldReports.filter(
      (field) => !field.baselineDataset,
    ).length,
  };

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          summary,
          fields: fieldReports,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(
    [
      `Generated: ${summary.generatedAt}`,
      `Workspace filter: ${summary.workspaceFilter ?? "all"}`,
      `Fields scanned: ${summary.fieldCount}`,
      `Missing moisture snapshots: ${summary.missingMoistureSnapshotCount}`,
      `Seeded moisture fields: ${summary.seededMoistureCount}`,
      `Synthetic raster fields: ${summary.syntheticRasterCount}`,
      `Provider raster fields: ${summary.providerRasterCount}`,
      `Raster + weather blend fields: ${summary.rasterAndWeatherBlendCount}`,
      `Weather-only fields: ${summary.weatherOnlyCount}`,
      `Fields with Sentinel-1 captures: ${summary.fieldsWithSentinel1Captures}`,
      `Fields with Sentinel-2 captures: ${summary.fieldsWithSentinel2Captures}`,
      `Fields with Planet captures: ${summary.fieldsWithPlanetCaptures}`,
      `Fields using SAR in moisture: ${summary.fieldsUsingSar}`,
      `Fields using optical in moisture: ${summary.fieldsUsingOptical}`,
      `Fields using Planet in moisture: ${summary.fieldsUsingPlanet}`,
      `Fields missing baseline dataset: ${summary.fieldsMissingBaselineDataset}`,
    ].join("\n"),
  );

  if (fieldReports.length === 0) {
    return;
  }

  console.log("\nField source utilization");
  console.table(
    fieldReports.slice(0, 40).map((field) => ({
      workspace: field.workspaceSlug ?? field.workspaceId,
      field: field.fieldName,
      blend: field.signalBlend ?? "none",
      rasterMode: field.rasterMode ?? "none",
      confidence: field.confidence ?? "",
      rasterSource: field.rasterSourceKey ?? "",
      weatherSource: field.weatherSourceKey ?? "",
      sentinel1: field.latestSentinel1CapturedAt ? "yes" : "",
      sentinel2: field.latestSentinel2CapturedAt ? "yes" : "",
      planet: field.latestPlanetCapturedAt ? "yes" : "",
      gaps: field.gaps.join(", "),
    })),
  );
}

void main().catch((error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : "Unknown source utilization report failure";
  console.error(`[worker-source-utilization] ${message}`);
  process.exitCode = 1;
});
