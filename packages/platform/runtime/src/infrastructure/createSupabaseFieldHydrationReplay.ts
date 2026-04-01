import type { FieldCropContext } from "@fieldpulse/module-field-crop-context";
import type { FieldRasterObservation } from "@fieldpulse/module-imagery";
import type {
  FieldMoistureCellSnapshot,
  FieldMoistureSnapshot,
} from "@fieldpulse/module-moisture";
import type {
  FieldWeatherDerivedSignalSet,
  FieldWeatherForecast,
  FieldWeatherObservation,
} from "@fieldpulse/module-weather";
import {
  requireSupabaseData,
  type DatabaseClient,
  type DatabaseSchema,
} from "@fieldpulse/platform-db";
import type { ServerRepositories } from "../contracts/ServerRuntime";

type SourceFieldRow = Pick<
  DatabaseSchema["app"]["Tables"]["fields"]["Row"],
  "id" | "workspace_id" | "name" | "legal_land_description"
>;

type WorkspaceRow = Pick<
  DatabaseSchema["app"]["Tables"]["workspaces"]["Row"],
  "id" | "slug"
>;
type ReplayFieldHydrationRpcRow =
  DatabaseSchema["app"]["Functions"]["replay_field_hydration_from_source"]["Returns"][number];

type ReplaySourceData = {
  candidate: SourceFieldRow;
  workspaceSlug: string | null;
  cropContext: FieldCropContext | null;
  weatherObservations: readonly FieldWeatherObservation[];
  latestSignalSet: FieldWeatherDerivedSignalSet | null;
  latestForecasts: readonly FieldWeatherForecast[];
  recentSnapshots: readonly FieldMoistureSnapshot[];
  latestCells: readonly FieldMoistureCellSnapshot[];
  latestRasterObservation: FieldRasterObservation | null;
  score: number;
  hydrated: boolean;
  nameMatched: boolean;
  lldMatched: boolean;
};

export type ReplayFieldHydrationInput = {
  targetWorkspaceId: string;
  targetFieldId: string;
  fieldName: string;
  cropType?: string;
  legalLandDescriptions: readonly string[];
};

export type ReplayFieldHydrationResult = {
  action: "replayed" | "skipped";
  reason?:
    | "missing-stable-key"
    | "no-source-field"
    | "no-hydrated-source"
    | "target-workspace-only";
  sourceFieldId?: string;
  sourceWorkspaceId?: string;
  sourceWorkspaceSlug?: string | null;
  copied?: {
    cropContext: boolean;
    weatherObservationCount: number;
    weatherForecastCount: number;
    weatherSignalSet: boolean;
    moistureSnapshotCount: number;
    moistureCellCount: number;
    rasterObservation: boolean;
  };
};

export type FieldHydrationReplay = {
  replayFromImportCandidate(
    input: ReplayFieldHydrationInput,
  ): Promise<ReplayFieldHydrationResult>;
};

const RECENT_WEATHER_LIMIT = 7;
const RECENT_MOISTURE_LIMIT = 14;
const FORECAST_LIMIT = 48;
const PREFERRED_TEMPLATE_WORKSPACE_SLUG = "hope-creek-farms";

function normalizeLldFragment(value: string) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

function buildCanonicalLldKeys(values: readonly string[]) {
  const normalized = values
    .map(normalizeLldFragment)
    .filter((value) => value.length > 0);

  if (normalized.length === 0) {
    return [];
  }

  const originalOrder = normalized.join(", ");
  const sortedOrder = [...normalized].sort().join(", ");

  return [...new Set([originalOrder, sortedOrder])];
}

function toTimestamp(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildReplaySourceScore(source: Omit<ReplaySourceData, "score" | "hydrated">) {
  return (
    (source.cropContext ? 1 : 0) +
    (source.weatherObservations.length > 0 ? 1 : 0) +
    (source.latestSignalSet ? 1 : 0) +
    (source.latestForecasts.length > 0 ? 1 : 0) +
    (source.recentSnapshots.length > 0 ? 1 : 0) +
    (source.latestCells.length > 0 ? 1 : 0) +
    (source.latestRasterObservation ? 1 : 0)
  );
}

function selectLatestForecasts(
  forecasts: readonly FieldWeatherForecast[],
): readonly FieldWeatherForecast[] {
  if (forecasts.length === 0) {
    return [];
  }

  const latestRunAt = forecasts.reduce((latest, forecast) => {
    return toTimestamp(forecast.forecastRunAt) > toTimestamp(latest)
      ? forecast.forecastRunAt
      : latest;
  }, forecasts[0]!.forecastRunAt);

  return forecasts
    .filter((forecast) => forecast.forecastRunAt === latestRunAt)
    .sort((left, right) => toTimestamp(left.validAt) - toTimestamp(right.validAt));
}

async function listCandidateFields(
  client: DatabaseClient,
  input: ReplayFieldHydrationInput,
): Promise<readonly SourceFieldRow[]> {
  const candidates = new Map<string, SourceFieldRow>();

  for (const canonicalLld of buildCanonicalLldKeys(input.legalLandDescriptions)) {
    const result = await client
      .from("fields")
      .select("id,workspace_id,name,legal_land_description")
      .eq("legal_land_description", canonicalLld);

    for (const row of requireSupabaseData(
      result,
      "fieldHydrationReplay.listCandidateFields.byLld",
    ) as readonly SourceFieldRow[]) {
      if (row.workspace_id === input.targetWorkspaceId) {
        continue;
      }
      candidates.set(row.id, row);
    }
  }

  const trimmedFieldName = input.fieldName.trim();
  if (trimmedFieldName) {
    const result = await client
      .from("fields")
      .select("id,workspace_id,name,legal_land_description")
      .eq("name", trimmedFieldName);

    for (const row of requireSupabaseData(
      result,
      "fieldHydrationReplay.listCandidateFields.byName",
    ) as readonly SourceFieldRow[]) {
      if (row.workspace_id === input.targetWorkspaceId) {
        continue;
      }
      candidates.set(row.id, row);
    }
  }

  return [...candidates.values()];
}

async function loadWorkspaceSlugs(
  client: DatabaseClient,
  workspaceIds: readonly string[],
) {
  if (workspaceIds.length === 0) {
    return new Map<string, string | null>();
  }

  const result = await client
    .from("workspaces")
    .select("id,slug")
    .in("id", workspaceIds);

  const rows = requireSupabaseData(
    result,
    "fieldHydrationReplay.loadWorkspaceSlugs",
  ) as readonly WorkspaceRow[];

  return new Map(rows.map((row) => [row.id, row.slug ?? null]));
}

async function loadReplaySourceData(
  repositories: ServerRepositories,
  candidate: SourceFieldRow,
  workspaceSlug: string | null,
  input: ReplayFieldHydrationInput,
): Promise<ReplaySourceData> {
  const [
    cropContext,
    weatherObservations,
    latestSignalSet,
    recentForecasts,
    recentSnapshots,
    latestRasterObservation,
  ] = await Promise.all([
    repositories.fieldCropContexts.getLatestByField(
      candidate.workspace_id,
      candidate.id,
    ),
    repositories.weatherObservations.listRecentByField(
      candidate.workspace_id,
      candidate.id,
      RECENT_WEATHER_LIMIT,
    ),
    repositories.weatherSignalSets.getLatestByField(
      candidate.workspace_id,
      candidate.id,
    ),
    repositories.weatherForecasts.listByField({
      workspaceId: candidate.workspace_id,
      fieldId: candidate.id,
      limit: FORECAST_LIMIT,
    }),
    repositories.moistureSnapshots.listRecentByField(
      candidate.workspace_id,
      candidate.id,
      RECENT_MOISTURE_LIMIT,
    ),
    repositories.imageryRasterObservations.getLatestByField(
      candidate.workspace_id,
      candidate.id,
    ),
  ]);

  const latestCells =
    recentSnapshots.length > 0
      ? await repositories.moistureCellSnapshots.getLatestByField(
          candidate.workspace_id,
          candidate.id,
        )
      : [];

  const base = {
    candidate,
    workspaceSlug,
    cropContext,
    weatherObservations,
    latestSignalSet,
    latestForecasts: selectLatestForecasts(recentForecasts),
    recentSnapshots,
    latestCells,
    latestRasterObservation,
    nameMatched:
      candidate.name.trim().toLowerCase() === input.fieldName.trim().toLowerCase(),
    lldMatched: buildCanonicalLldKeys(input.legalLandDescriptions).includes(
      normalizeLldFragment(candidate.legal_land_description ?? ""),
    ),
  };

  const score = buildReplaySourceScore(base);

  return {
    ...base,
    score,
    hydrated:
      base.weatherObservations.length > 0 ||
      base.recentSnapshots.length > 0 ||
      base.latestRasterObservation != null,
  };
}

function compareReplaySources(left: ReplaySourceData, right: ReplaySourceData) {
  if (right.hydrated !== left.hydrated) {
    return Number(right.hydrated) - Number(left.hydrated);
  }

  if (right.score !== left.score) {
    return right.score - left.score;
  }

  if (right.lldMatched !== left.lldMatched) {
    return Number(right.lldMatched) - Number(left.lldMatched);
  }

  if (right.nameMatched !== left.nameMatched) {
    return Number(right.nameMatched) - Number(left.nameMatched);
  }

  if (
    right.workspaceSlug === PREFERRED_TEMPLATE_WORKSPACE_SLUG &&
    left.workspaceSlug !== PREFERRED_TEMPLATE_WORKSPACE_SLUG
  ) {
    return 1;
  }

  if (
    left.workspaceSlug === PREFERRED_TEMPLATE_WORKSPACE_SLUG &&
    right.workspaceSlug !== PREFERRED_TEMPLATE_WORKSPACE_SLUG
  ) {
    return -1;
  }

  return 0;
}

function mapReplayResult(row: ReplayFieldHydrationRpcRow) {
  return {
    cropContext: row.copied_crop_context,
    weatherObservationCount: row.weather_observation_count,
    weatherForecastCount: row.weather_forecast_count,
    weatherSignalSet: row.weather_signal_set,
    moistureSnapshotCount: row.moisture_snapshot_count,
    moistureCellCount: row.moisture_cell_count,
    rasterObservation: row.raster_observation,
  };
}

export function createSupabaseFieldHydrationReplay(
  client: DatabaseClient,
  repositories: Pick<
    ServerRepositories,
    | "fieldCropContexts"
    | "imageryRasterObservations"
    | "moistureCellSnapshots"
    | "moistureSnapshots"
    | "weatherForecasts"
    | "weatherObservations"
    | "weatherSignalSets"
  >,
): FieldHydrationReplay {
  return {
    async replayFromImportCandidate(
      input: ReplayFieldHydrationInput,
    ): Promise<ReplayFieldHydrationResult> {
      if (
        input.legalLandDescriptions.length === 0 &&
        input.fieldName.trim().length === 0
      ) {
        return {
          action: "skipped",
          reason: "missing-stable-key",
        };
      }

      const candidates = await listCandidateFields(client, input);
      if (candidates.length === 0) {
        return {
          action: "skipped",
          reason: "no-source-field",
        };
      }

      const workspaceSlugs = await loadWorkspaceSlugs(
        client,
        [...new Set(candidates.map((candidate) => candidate.workspace_id))],
      );
      const sources = await Promise.all(
        candidates.map((candidate) =>
          loadReplaySourceData(
            repositories as ServerRepositories,
            candidate,
            workspaceSlugs.get(candidate.workspace_id) ?? null,
            input,
          ),
        ),
      );

      const bestSource = [...sources].sort(compareReplaySources)[0];
      if (!bestSource) {
        return {
          action: "skipped",
          reason: "no-source-field",
        };
      }

      if (!bestSource.hydrated) {
        return {
          action: "skipped",
          reason: candidates.every(
            (candidate) => candidate.workspace_id === input.targetWorkspaceId,
          )
            ? "target-workspace-only"
            : "no-hydrated-source",
        };
      }

      const replayResult = await client
        .rpc("replay_field_hydration_from_source", {
          source_field_id: bestSource.candidate.id,
          target_workspace_id: input.targetWorkspaceId,
          target_field_id: input.targetFieldId,
          target_crop_type: input.cropType ?? null,
        })
        .single();

      const replayedCounts = mapReplayResult(
        requireSupabaseData(
          replayResult,
          "fieldHydrationReplay.replayFromImportCandidate.rpc",
        ) as ReplayFieldHydrationRpcRow,
      );

      return {
        action: "replayed",
        sourceFieldId: bestSource.candidate.id,
        sourceWorkspaceId: bestSource.candidate.workspace_id,
        sourceWorkspaceSlug: bestSource.workspaceSlug,
        copied: replayedCounts,
      };
    },
  };
}
