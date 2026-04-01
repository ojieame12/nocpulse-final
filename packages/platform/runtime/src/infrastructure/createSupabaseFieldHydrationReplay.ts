import {
  requireSupabaseData,
  type DatabaseClient,
  type DatabaseSchema,
} from "@fieldpulse/platform-db";
import type { ServerRepositories } from "../contracts/ServerRuntime";

type ReplayFieldHydrationRpcRow =
  DatabaseSchema["app"]["Functions"]["replay_field_hydration_from_import_candidate"]["Returns"][number];

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

function mapReplayResult(row: ReplayFieldHydrationRpcRow): ReplayFieldHydrationResult {
  if (row.action !== "replayed") {
    return {
      action: "skipped",
      reason:
        row.reason === "missing-stable-key" ||
        row.reason === "no-source-field" ||
        row.reason === "no-hydrated-source" ||
        row.reason === "target-workspace-only"
          ? row.reason
          : undefined,
      sourceFieldId: row.source_field_id ?? undefined,
      sourceWorkspaceId: row.source_workspace_id ?? undefined,
      sourceWorkspaceSlug: row.source_workspace_slug ?? undefined,
    };
  }

  return {
    action: "replayed",
    sourceFieldId: row.source_field_id ?? undefined,
    sourceWorkspaceId: row.source_workspace_id ?? undefined,
    sourceWorkspaceSlug: row.source_workspace_slug ?? undefined,
    copied: {
      cropContext: row.copied_crop_context,
      weatherObservationCount: row.weather_observation_count,
      weatherForecastCount: row.weather_forecast_count,
      weatherSignalSet: row.weather_signal_set,
      moistureSnapshotCount: row.moisture_snapshot_count,
      moistureCellCount: row.moisture_cell_count,
      rasterObservation: row.raster_observation,
    },
  };
}

export function createSupabaseFieldHydrationReplay(
  client: DatabaseClient,
  _repositories?: Pick<
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
      const result = await client
        .rpc("replay_field_hydration_from_import_candidate", {
          target_workspace_id: input.targetWorkspaceId,
          target_field_id: input.targetFieldId,
          target_field_name: input.fieldName.trim(),
          target_legal_land_descriptions: buildCanonicalLldKeys(
            input.legalLandDescriptions,
          ),
          target_crop_type: input.cropType ?? null,
        })
        .single();

      return mapReplayResult(
        requireSupabaseData(
          result,
          "fieldHydrationReplay.replayFromImportCandidate.rpc",
        ) as ReplayFieldHydrationRpcRow,
      );
    },
  };
}
