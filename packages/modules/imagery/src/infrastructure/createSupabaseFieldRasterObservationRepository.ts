import {
  requireSupabaseData,
  requireSupabaseSuccess,
  type DatabaseClient,
  type DatabaseSchema,
  type EntityId,
  type JsonValue,
  type TimestampIso,
  type WorkspaceId,
} from "@fieldpulse/platform-db";
import type {
  FieldRasterObservation,
  FieldRasterObservationMetadata,
  ReplaceFieldRasterObservationInput,
} from "../contracts/FieldRasterObservation";
import type { FieldRasterObservationRepository } from "./FieldRasterObservationRepository";

type FieldRasterObservationRow =
  DatabaseSchema["app"]["Tables"]["field_raster_observations"]["Row"];
type FieldRasterObservationCellRow =
  DatabaseSchema["app"]["Tables"]["field_raster_observation_cells"]["Row"];

function isRecord(value: JsonValue): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toMetadata(value: JsonValue): FieldRasterObservationMetadata {
  if (!isRecord(value)) {
    return {};
  }

  const metadata: Record<string, string | number | boolean | null> = {};

  for (const [key, entryValue] of Object.entries(value)) {
    if (
      typeof entryValue === "string" ||
      typeof entryValue === "number" ||
      typeof entryValue === "boolean" ||
      entryValue === null
    ) {
      metadata[key] = entryValue;
    }
  }

  return Object.freeze(metadata);
}

function mapCell(row: FieldRasterObservationCellRow) {
  const centroid = row.centroid as {
    type: "Point";
    coordinates: readonly [number, number];
  };

  const measurements: Record<string, number> = {};

  if (isRecord(row.measurements)) {
    for (const [key, value] of Object.entries(row.measurements)) {
      if (typeof value === "number") {
        measurements[key] = value;
      }
    }
  }

  return {
    cellKey: row.cell_key,
    rowIndex: row.row_index,
    columnIndex: row.column_index,
    centroid: centroid.coordinates,
    boundary: row.boundary as {
      type: "Polygon";
      coordinates: readonly (readonly [number, number][])[];
    },
    measurements,
  };
}

function mapObservation(
  row: FieldRasterObservationRow,
  cells: readonly FieldRasterObservationCellRow[],
): FieldRasterObservation {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    fieldId: row.field_id,
    observedAt: row.observed_at,
    sourceKey: row.source_key,
    providerKey: row.provider_key,
    artifactKey: row.artifact_key,
    metadata: toMetadata(row.metadata),
    cells: cells.map(mapCell),
    createdAt: row.created_at,
  };
}

function toTimestampMillis(value: TimestampIso | null) {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isConcurrentReplaceObservationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  return (
    message.includes(
      "field_raster_observations_workspace_field_source_observed_uidx",
    ) ||
    message.includes(
      "field_raster_observation_cells_observation_id_fkey",
    )
  );
}

function getObservationPriority(row: FieldRasterObservationRow) {
  const metadata = toMetadata(row.metadata);
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
    !row.source_key.startsWith("synthetic-")
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

async function findLatestObservation(
  client: DatabaseClient,
  workspaceId: WorkspaceId,
  fieldId: EntityId,
  providerKey?: string,
  observedAt?: TimestampIso,
): Promise<FieldRasterObservationRow | null> {
  let query = client
    .from("field_raster_observations")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("field_id", fieldId);

  if (providerKey) {
    query = query.eq("provider_key", providerKey);
  }

  if (observedAt) {
    query = query.lte("observed_at", observedAt);
  }

  const result = await query;

  if (result.error) {
    throw result.error;
  }

  const rows = requireSupabaseData(
    result,
    "imageryRasterObservations.findLatestObservation",
  );

  if (rows.length === 0) {
    return null;
  }

  return [...rows].sort((left, right) => {
    const priorityDelta =
      getObservationPriority(right) - getObservationPriority(left);
    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    const observedAtDelta =
      toTimestampMillis(right.observed_at) - toTimestampMillis(left.observed_at);
    if (observedAtDelta !== 0) {
      return observedAtDelta;
    }

    return (
      toTimestampMillis(right.created_at) - toTimestampMillis(left.created_at)
    );
  })[0];
}

export function createSupabaseFieldRasterObservationRepository(
  client: DatabaseClient,
): FieldRasterObservationRepository {
  async function replaceObservationOnce(
    input: ReplaceFieldRasterObservationInput,
  ): Promise<FieldRasterObservation> {
    await requireSupabaseSuccess(
      await client
        .from("field_raster_observations")
        .delete()
        .eq("workspace_id", input.workspaceId)
        .eq("field_id", input.fieldId)
        .eq("source_key", input.sourceKey)
        .eq("observed_at", input.observedAt),
      "imageryRasterObservations.replaceObservation.delete",
    );

    const observationResult = await client
      .from("field_raster_observations")
      .insert({
        workspace_id: input.workspaceId,
        field_id: input.fieldId,
        observed_at: input.observedAt,
        source_key: input.sourceKey,
        provider_key: input.providerKey,
        artifact_key: input.artifactKey ?? null,
        metadata: input.metadata ?? {},
      })
      .select("*")
      .single();

    const observation = requireSupabaseData(
      observationResult,
      "imageryRasterObservations.replaceObservation.insertObservation",
    );

    const cellsResult = await client
      .from("field_raster_observation_cells")
      .insert(
        input.cells.map((cell) => ({
          observation_id: observation.id,
          workspace_id: input.workspaceId,
          field_id: input.fieldId,
          observed_at: input.observedAt,
          source_key: input.sourceKey,
          provider_key: input.providerKey,
          cell_key: cell.cellKey,
          row_index: cell.rowIndex,
          column_index: cell.columnIndex,
          centroid: {
            type: "Point",
            coordinates: cell.centroid,
          },
          boundary: cell.boundary,
          measurements: cell.measurements,
        })),
      )
      .select("*");

    return mapObservation(
      observation,
      requireSupabaseData(
        cellsResult,
        "imageryRasterObservations.replaceObservation.insertCells",
      ),
    );
  }

  return {
    async getLatestByField(workspaceId, fieldId, observedAt) {
      const observation = await findLatestObservation(
        client,
        workspaceId,
        fieldId,
        undefined,
        observedAt,
      );

      if (!observation) {
        return null;
      }

      const cellsResult = await client
        .from("field_raster_observation_cells")
        .select("*")
        .eq("observation_id", observation.id)
        .order("row_index", { ascending: true })
        .order("column_index", { ascending: true });

      return mapObservation(
        observation,
        requireSupabaseData(
          cellsResult,
          "imageryRasterObservations.getLatestByField.cells",
        ),
      );
    },

    async getLatestByFieldAndProvider(
      workspaceId,
      fieldId,
      providerKey,
      observedAt,
    ) {
      const observation = await findLatestObservation(
        client,
        workspaceId,
        fieldId,
        providerKey,
        observedAt,
      );

      if (!observation) {
        return null;
      }

      const cellsResult = await client
        .from("field_raster_observation_cells")
        .select("*")
        .eq("observation_id", observation.id)
        .order("row_index", { ascending: true })
        .order("column_index", { ascending: true });

      return mapObservation(
        observation,
        requireSupabaseData(
          cellsResult,
          "imageryRasterObservations.getLatestByFieldAndProvider.cells",
        ),
      );
    },

    async replaceObservation(input) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          return await replaceObservationOnce(input);
        } catch (error) {
          if (attempt === 0 && isConcurrentReplaceObservationError(error)) {
            await sleep(150);
            continue;
          }

          throw error;
        }
      }

      throw new Error(
        "imageryRasterObservations.replaceObservation exhausted retries",
      );
    },
  };
}
