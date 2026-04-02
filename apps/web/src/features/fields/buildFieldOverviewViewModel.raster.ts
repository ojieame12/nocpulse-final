import type { FieldAgronomicSurfaceMetricKey } from "@fieldpulse/map";
import {
  deriveSourceBackedMoistureEstimate,
  type FieldRasterObservation,
} from "@fieldpulse/module-imagery";
import { getWebServerRuntime } from "../../server/runtime/getWebServerRuntime";
import { createServerDatabaseClient } from "../../server/runtime/createServerDatabaseClient";
import {
  chooseLatestObservation,
  toPrimitiveMetadata,
  toTimestampMillis,
} from "./buildFieldOverviewViewModel.shared";

type MetricFamilyRasterObservations = {
  latestSarObservation: FieldRasterObservation | null;
  previousSarObservation: FieldRasterObservation | null;
  latestOpticalObservation: FieldRasterObservation | null;
  previousOpticalObservation: FieldRasterObservation | null;
  latestNdmiObservation: FieldRasterObservation | null;
  latestOpticalCapture: any | null;
  latestSarCapture: any | null;
  opticalHistory: readonly FieldRasterObservation[];
  sarHistory: readonly FieldRasterObservation[];
};

type RawImageryCaptureRow = {
  id: string;
  workspace_id: string;
  field_id: string;
  requested_at: string;
  captured_at: string;
  provider_key: string;
  scene_key: string;
  status: string;
  coverage_pct: number | string | null;
  cloud_cover_pct: number | string | null;
  note: string | null;
  metadata: unknown;
  observation_id: string | null;
  created_at: string;
};

type RawRasterObservationRow = {
  id: string;
  workspace_id: string;
  field_id: string;
  observed_at: string;
  source_key: string;
  provider_key: string;
  artifact_key: string | null;
  metadata: unknown;
  created_at: string;
};

function createEmptyMetricFamilyRasterObservations(): MetricFamilyRasterObservations {
  return {
    latestSarObservation: null,
    previousSarObservation: null,
    latestOpticalObservation: null,
    previousOpticalObservation: null,
    latestNdmiObservation: null,
    latestOpticalCapture: null,
    latestSarCapture: null,
    opticalHistory: [],
    sarHistory: [],
  };
}

async function readOptionalMetricFamilyValue<T>(
  label: string,
  operation: () => Promise<T>,
  fallbackValue: T,
): Promise<T> {
  try {
    return await operation();
  } catch (error: unknown) {
    console.error(`[buildFieldOverviewViewModel.raster] failed to load ${label}:`, error);
    return fallbackValue;
  }
}

function getRawObservationPriority(row: {
  source_key?: string | null;
  metadata?: unknown;
}) {
  const metadata = toPrimitiveMetadata(row.metadata);
  const mode = typeof metadata.mode === "string" ? metadata.mode : null;
  const materializationMode =
    typeof metadata.materializationMode === "string"
      ? metadata.materializationMode
      : null;

  if (mode === "synthetic-seeded") {
    return 0;
  }

  if (
    materializationMode === "provider" ||
    !(row.source_key ?? "").startsWith("synthetic-")
  ) {
    return 3;
  }

  if (
    materializationMode === "synthetic" ||
    materializationMode === "synthetic-fallback"
  ) {
    return 2;
  }

  return 1;
}

function mapRawObservationCell(row: any) {
  return {
    cellKey: row.cell_key,
    rowIndex: row.row_index,
    columnIndex: row.column_index,
    centroid: (row.centroid as { coordinates?: readonly [number, number] })
      .coordinates ?? [0, 0],
    boundary: row.boundary as {
      type: "Polygon";
      coordinates: readonly (readonly [number, number][])[];
    },
    measurements: Object.fromEntries(
      Object.entries(row.measurements ?? {}).filter((entry): entry is [string, number] =>
        typeof entry[1] === "number"
      ),
    ),
  };
}

function mapRawObservation(row: any, cells: readonly any[]): FieldRasterObservation {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    fieldId: row.field_id,
    observedAt: row.observed_at,
    sourceKey: row.source_key,
    providerKey: row.provider_key,
    artifactKey: row.artifact_key,
    metadata: toPrimitiveMetadata(row.metadata),
    cells: cells.map(mapRawObservationCell),
    createdAt: row.created_at,
  };
}

function mapRawCapture(row: RawImageryCaptureRow) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    fieldId: row.field_id,
    requestedAt: row.requested_at,
    capturedAt: row.captured_at,
    providerKey: row.provider_key,
    sceneKey: row.scene_key,
    status: row.status,
    coveragePct: Number(row.coverage_pct),
    cloudCoverPct:
      row.cloud_cover_pct == null ? null : Number(row.cloud_cover_pct),
    note: row.note,
    metadata: toPrimitiveMetadata(row.metadata),
    observationId: row.observation_id,
    createdAt: row.created_at,
  };
}

function compareRawCaptureRecency(left: RawImageryCaptureRow, right: RawImageryCaptureRow) {
  const capturedAtDelta =
    toTimestampMillis(right.captured_at) - toTimestampMillis(left.captured_at);
  if (capturedAtDelta !== 0) {
    return capturedAtDelta;
  }

  const createdAtDelta =
    toTimestampMillis(right.created_at) - toTimestampMillis(left.created_at);
  if (createdAtDelta !== 0) {
    return createdAtDelta;
  }

  return toTimestampMillis(right.requested_at) - toTimestampMillis(left.requested_at);
}

export function selectLatestMetricFamilyCaptures(
  captures: readonly RawImageryCaptureRow[],
) {
  let latestOpticalCapture: ReturnType<typeof mapRawCapture> | null = null;
  let latestSarCapture: ReturnType<typeof mapRawCapture> | null = null;

  for (const capture of [...captures].sort(compareRawCaptureRecency)) {
    if (
      !latestOpticalCapture &&
      (capture.provider_key === "sentinel-2" || capture.provider_key === "planet")
    ) {
      latestOpticalCapture = mapRawCapture(capture);
    }

    if (!latestSarCapture && capture.provider_key === "sentinel-1") {
      latestSarCapture = mapRawCapture(capture);
    }

    if (latestOpticalCapture && latestSarCapture) {
      break;
    }
  }

  return {
    latestOpticalCapture,
    latestSarCapture,
  };
}

function isOpticalProviderKey(providerKey: string | null | undefined) {
  return providerKey === "sentinel-2" || providerKey === "planet";
}

type MetricFamilyObservationSelection = {
  opticalRows: RawRasterObservationRow[];
  sarRows: RawRasterObservationRow[];
};

export function selectMetricFamilyObservationRows(
  rows: readonly RawRasterObservationRow[],
  limits: {
    optical: number;
    sar: number;
  },
): MetricFamilyObservationSelection {
  const opticalRows: RawRasterObservationRow[] = [];
  const sarRows: RawRasterObservationRow[] = [];

  for (const row of rows) {
    if (isOpticalProviderKey(row.provider_key)) {
      if (opticalRows.length < limits.optical) {
        opticalRows.push(row);
      }
    } else if (row.provider_key === "sentinel-1") {
      if (sarRows.length < limits.sar) {
        sarRows.push(row);
      }
    }

    if (opticalRows.length >= limits.optical && sarRows.length >= limits.sar) {
      break;
    }
  }

  return {
    opticalRows,
    sarRows,
  };
}

export function deriveObservationRootMoisturePct(
  observation: FieldRasterObservation | null | undefined,
) {
  if (!observation || !Array.isArray(observation.cells) || observation.cells.length === 0) {
    return null;
  }

  const estimate = deriveSourceBackedMoistureEstimate({
    rasterObservation: observation,
  });
  if (!estimate) {
    return null;
  }

  return estimate.rootZonePct;
}

export function deriveObservationSurfaceMoisturePct(
  observation: FieldRasterObservation | null | undefined,
) {
  if (!observation || !Array.isArray(observation.cells) || observation.cells.length === 0) {
    return null;
  }

  const estimate = deriveSourceBackedMoistureEstimate({
    rasterObservation: observation,
  });
  if (!estimate) {
    return null;
  }

  return estimate.surfacePct;
}

export function averageMeasurement(
  cells: readonly { measurements: Readonly<Record<string, number>> }[],
  key: string,
) {
  const values = cells
    .map((cell) => cell.measurements[key])
    .filter((value): value is number => typeof value === "number");

  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function averageAgronomicMeasurement(
  cells: readonly { measurements: Readonly<Record<string, number>> }[],
  metricKey: FieldAgronomicSurfaceMetricKey,
) {
  const values = cells
    .map((cell) => {
      if (metricKey === "radar-wetness") {
        const radarWetness = cell.measurements.sarWetness;
        return typeof radarWetness === "number" ? radarWetness : null;
      }

      if (metricKey === "ndmi") {
        const ndmi = cell.measurements.ndmi;
        return typeof ndmi === "number" ? ndmi : null;
      }

      const value = cell.measurements[metricKey];
      return typeof value === "number" ? value : null;
    })
    .filter((value): value is number => typeof value === "number");

  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function observationHasMetric(
  observation: FieldRasterObservation | null | undefined,
  metricKey: FieldAgronomicSurfaceMetricKey,
) {
  if (!observation || !Array.isArray(observation.cells) || observation.cells.length === 0) {
    return false;
  }

  return averageAgronomicMeasurement(observation.cells, metricKey) != null;
}

async function loadRecentRasterObservationHistory(input: {
  client: ReturnType<typeof createServerDatabaseClient>;
  workspaceId: string;
  fieldId: string;
  providerKeys: readonly string[];
  observedAt?: string;
  limit: number;
}) {
  let query = input.client
    .from("field_raster_observations")
    .select("*")
    .eq("workspace_id", input.workspaceId)
    .eq("field_id", input.fieldId)
    .in("provider_key", [...input.providerKeys]);

  if (input.observedAt) {
    query = query.lte("observed_at", input.observedAt);
  }

  const rowsResult = await query
    .order("observed_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(Math.max(input.limit * 3, input.limit));

  if (rowsResult.error) {
    throw rowsResult.error;
  }

  const prioritizedRows = [...(rowsResult.data ?? [])]
    .sort((left, right) => {
      const priorityDelta =
        getRawObservationPriority(right) - getRawObservationPriority(left);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      const observedAtDelta =
        toTimestampMillis(right.observed_at) - toTimestampMillis(left.observed_at);
      if (observedAtDelta !== 0) {
        return observedAtDelta;
      }

      return toTimestampMillis(right.created_at) - toTimestampMillis(left.created_at);
    });

  const dedupedRows = prioritizedRows.filter((row, index, rows) => {
    const dedupeKey = `${row.provider_key}:${row.observed_at}`;
    return (
      rows.findIndex(
        (candidate) =>
          `${candidate.provider_key}:${candidate.observed_at}` === dedupeKey,
      ) === index
    );
  }).slice(0, input.limit);

  if (dedupedRows.length === 0) {
    return [] as FieldRasterObservation[];
  }

  const cellsResult = await input.client
    .from("field_raster_observation_cells")
    .select("*")
    .in(
      "observation_id",
      dedupedRows.map((row) => row.id),
    )
    .order("row_index", { ascending: true })
    .order("column_index", { ascending: true });

  if (cellsResult.error) {
    throw cellsResult.error;
  }

  const groupedCells = new Map<string, any[]>();
  for (const row of cellsResult.data ?? []) {
    const list = groupedCells.get(row.observation_id) ?? [];
    list.push(row);
    groupedCells.set(row.observation_id, list);
  }

  return dedupedRows.map((row) =>
    mapRawObservation(row, groupedCells.get(row.id) ?? []),
  );
}

async function loadRecentMetricFamilyRasterHistory(input: {
  client: ReturnType<typeof createServerDatabaseClient>;
  workspaceId: string;
  fieldId: string;
  observedAt?: string;
  opticalLimit: number;
  sarLimit: number;
}) {
  let query = input.client
    .from("field_raster_observations")
    .select("*")
    .eq("workspace_id", input.workspaceId)
    .eq("field_id", input.fieldId)
    .in("provider_key", ["sentinel-2", "planet", "sentinel-1"]);

  if (input.observedAt) {
    query = query.lte("observed_at", input.observedAt);
  }

  const totalLimit = input.opticalLimit + input.sarLimit;
  const rowsResult = await query
    .order("observed_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(Math.max(totalLimit * 4, totalLimit));

  if (rowsResult.error) {
    throw rowsResult.error;
  }

  const prioritizedRows = [...((rowsResult.data ?? []) as RawRasterObservationRow[])]
    .sort((left, right) => {
      const priorityDelta =
        getRawObservationPriority(right) - getRawObservationPriority(left);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      const observedAtDelta =
        toTimestampMillis(right.observed_at) - toTimestampMillis(left.observed_at);
      if (observedAtDelta !== 0) {
        return observedAtDelta;
      }

      return toTimestampMillis(right.created_at) - toTimestampMillis(left.created_at);
    });

  const dedupedRows = prioritizedRows.filter((row, index, rows) => {
    const dedupeKey = `${row.provider_key}:${row.observed_at}`;
    return (
      rows.findIndex(
        (candidate) =>
          `${candidate.provider_key}:${candidate.observed_at}` === dedupeKey,
      ) === index
    );
  });
  const { opticalRows, sarRows } = selectMetricFamilyObservationRows(dedupedRows, {
    optical: input.opticalLimit,
    sar: input.sarLimit,
  });
  const selectedRows = [...opticalRows, ...sarRows];

  if (selectedRows.length === 0) {
    return {
      opticalHistory: [] as FieldRasterObservation[],
      sarHistory: [] as FieldRasterObservation[],
    };
  }

  const cellsResult = await input.client
    .from("field_raster_observation_cells")
    .select("*")
    .in(
      "observation_id",
      selectedRows.map((row) => row.id),
    )
    .order("row_index", { ascending: true })
    .order("column_index", { ascending: true });

  if (cellsResult.error) {
    throw cellsResult.error;
  }

  const groupedCells = new Map<string, any[]>();
  for (const row of cellsResult.data ?? []) {
    const list = groupedCells.get(row.observation_id) ?? [];
    list.push(row);
    groupedCells.set(row.observation_id, list);
  }

  return {
    opticalHistory: opticalRows.map((row) =>
      mapRawObservation(row, groupedCells.get(row.id) ?? []),
    ),
    sarHistory: sarRows.map((row) =>
      mapRawObservation(row, groupedCells.get(row.id) ?? []),
    ),
  };
}

async function loadRecentImageryCaptures(input: {
  client: ReturnType<typeof createServerDatabaseClient>;
  workspaceId: string;
  fieldId: string;
}) {
  const recentCapturesResult = await input.client
    .from("field_imagery_captures")
    .select("*")
    .eq("workspace_id", input.workspaceId)
    .eq("field_id", input.fieldId)
    .order("captured_at", { ascending: false })
    .limit(12);

  if (recentCapturesResult.error) {
    throw recentCapturesResult.error;
  }

  return recentCapturesResult.data ?? [];
}

export async function loadMetricFamilyRasterObservations(input: {
  runtime: ReturnType<typeof getWebServerRuntime>;
  workspaceId: string;
  fieldId: string;
  observedAt?: string;
}): Promise<MetricFamilyRasterObservations> {
  if (input.runtime.mode !== "supabase") {
    return createEmptyMetricFamilyRasterObservations();
  }

  const client = createServerDatabaseClient(input.runtime);
  const [recentCaptures, metricFamilyHistory] = await Promise.all([
    readOptionalMetricFamilyValue(
      "recent imagery captures",
      () =>
        loadRecentImageryCaptures({
          client,
          workspaceId: input.workspaceId,
          fieldId: input.fieldId,
        }),
      [] as RawImageryCaptureRow[],
    ),
    readOptionalMetricFamilyValue(
      "metric family raster history",
      () =>
        loadRecentMetricFamilyRasterHistory({
          client,
          workspaceId: input.workspaceId,
          fieldId: input.fieldId,
          observedAt: input.observedAt,
          opticalLimit: 6,
          sarLimit: 6,
        }),
      {
        opticalHistory: [] as FieldRasterObservation[],
        sarHistory: [] as FieldRasterObservation[],
      },
    ),
  ]);
  const opticalHistory = metricFamilyHistory.opticalHistory;
  const sarHistory = metricFamilyHistory.sarHistory;

  const latestSarObservation = sarHistory[0] ?? null;
  const latestSentinel2Observation =
    opticalHistory.find(
      (observation: FieldRasterObservation) =>
        observation.providerKey === "sentinel-2",
    ) ?? null;
  const latestPlanetObservation =
    opticalHistory.find(
      (observation: FieldRasterObservation) =>
        observation.providerKey === "planet",
    ) ?? null;

  const latestOpticalObservation = chooseLatestObservation([
    latestPlanetObservation,
    latestSentinel2Observation,
  ]);
  const previousSentinel2Observation =
    latestOpticalObservation == null
      ? null
      : opticalHistory.find(
          (observation: FieldRasterObservation) =>
            observation.providerKey === "sentinel-2" &&
            toTimestampMillis(observation.observedAt) <
              toTimestampMillis(latestOpticalObservation.observedAt),
        ) ?? null;
  const previousPlanetObservation =
    latestOpticalObservation == null
      ? null
      : opticalHistory.find(
          (observation: FieldRasterObservation) =>
            observation.providerKey === "planet" &&
            toTimestampMillis(observation.observedAt) <
              toTimestampMillis(latestOpticalObservation.observedAt),
        ) ?? null;
  const previousSarObservation =
    latestSarObservation == null
      ? null
      : sarHistory.find(
          (observation: FieldRasterObservation) =>
            toTimestampMillis(observation.observedAt) <
            toTimestampMillis(latestSarObservation.observedAt),
        ) ?? null;

  const { latestOpticalCapture, latestSarCapture } =
    selectLatestMetricFamilyCaptures(recentCaptures);

  const latestNdmiObservation = chooseLatestObservation(
    [latestOpticalObservation].filter((observation) =>
      observationHasMetric(observation, "ndmi"),
    ),
  );

  return {
    latestSarObservation,
    previousSarObservation,
    latestOpticalObservation,
    previousOpticalObservation: chooseLatestObservation([
      previousPlanetObservation,
      previousSentinel2Observation,
    ]),
    latestNdmiObservation,
    latestOpticalCapture,
    latestSarCapture,
    opticalHistory,
    sarHistory,
  };
}
