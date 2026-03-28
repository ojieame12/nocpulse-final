import {
  coerceNumber,
  requireSupabaseData,
  requireSupabaseSuccess,
  type DatabaseClient,
  type DatabaseSchema,
  type EntityId,
  type JsonValue,
  type WorkspaceId,
} from "@fieldpulse/platform-db";
import type {
  FieldMoistureCellSnapshot,
  MoistureCellPoint,
  MoistureCellPolygon,
  ReplaceFieldMoistureCellSnapshotsInput,
} from "../contracts/FieldMoistureCellSnapshot";
import type { FieldMoistureCellSnapshotRepository } from "./FieldMoistureCellSnapshotRepository";

type FieldMoistureCellSnapshotRow =
  DatabaseSchema["app"]["Tables"]["field_moisture_cell_snapshots"]["Row"];

function isRecord(value: JsonValue): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toPoint(value: JsonValue, context: string): MoistureCellPoint {
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    typeof value[0] !== "number" ||
    typeof value[1] !== "number"
  ) {
    throw new Error(`[moisture] invalid point coordinates for ${context}`);
  }

  return [value[0], value[1]];
}

function toPolygon(value: JsonValue): MoistureCellPolygon {
  if (!isRecord(value) || value.type !== "Polygon" || !Array.isArray(value.coordinates)) {
    throw new Error("[moisture] invalid cell boundary geojson");
  }

  return value as unknown as MoistureCellPolygon;
}

function toCentroid(value: JsonValue): MoistureCellPoint {
  if (!isRecord(value) || value.type !== "Point" || !("coordinates" in value)) {
    throw new Error("[moisture] invalid cell centroid geojson");
  }

  return toPoint(value.coordinates, "cell centroid");
}

function mapFieldMoistureCellSnapshot(
  row: FieldMoistureCellSnapshotRow,
): FieldMoistureCellSnapshot {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    fieldId: row.field_id,
    snapshotId: row.snapshot_id,
    observedAt: row.observed_at,
    sourceKey: row.source_key,
    cellKey: row.cell_key,
    rowIndex: row.row_index,
    columnIndex: row.column_index,
    centroid: toCentroid(row.centroid),
    boundary: toPolygon(row.boundary),
    rootZonePct: coerceNumber(row.root_zone_pct),
    surfacePct: coerceNumber(row.surface_pct),
    confidence: row.confidence,
    createdAt: row.created_at,
  };
}

async function getLatestSnapshotId(
  client: DatabaseClient,
  workspaceId: WorkspaceId,
  fieldId: EntityId,
): Promise<string | null> {
  const result = await client
    .from("field_moisture_cell_snapshots")
    .select("snapshot_id")
    .eq("workspace_id", workspaceId)
    .eq("field_id", fieldId)
    .order("observed_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (result.error) {
    throw result.error;
  }

  return result.data?.snapshot_id ?? null;
}

export function createSupabaseFieldMoistureCellSnapshotRepository(
  client: DatabaseClient,
): FieldMoistureCellSnapshotRepository {
  return {
    async getLatestByField(workspaceId, fieldId) {
      const snapshotId = await getLatestSnapshotId(client, workspaceId, fieldId);

      if (!snapshotId) {
        return [];
      }

      const result = await client
        .from("field_moisture_cell_snapshots")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("field_id", fieldId)
        .eq("snapshot_id", snapshotId)
        .order("row_index", { ascending: true })
        .order("column_index", { ascending: true });

      return requireSupabaseData(
        result,
        "moistureCells.getLatestByField",
      ).map(mapFieldMoistureCellSnapshot);
    },

    async replaceSnapshotCells(input) {
      await requireSupabaseSuccess(
        await client
          .from("field_moisture_cell_snapshots")
          .delete()
          .eq("workspace_id", input.workspaceId)
          .eq("field_id", input.fieldId)
          .eq("snapshot_id", input.snapshotId),
        "moistureCells.replaceSnapshotCells.delete",
      );

      const result = await client
        .from("field_moisture_cell_snapshots")
        .insert(
          input.cells.map((cell) => ({
            workspace_id: input.workspaceId,
            field_id: input.fieldId,
            snapshot_id: input.snapshotId,
            observed_at: input.observedAt,
            source_key: input.sourceKey,
            cell_key: cell.cellKey,
            row_index: cell.rowIndex,
            column_index: cell.columnIndex,
            centroid: {
              type: "Point",
              coordinates: cell.centroid,
            },
            boundary: cell.boundary,
            root_zone_pct: cell.rootZonePct,
            surface_pct: cell.surfacePct,
            confidence: input.confidence,
          })),
        )
        .select("*");

      return requireSupabaseData(
        result,
        "moistureCells.replaceSnapshotCells.insert",
      ).map(mapFieldMoistureCellSnapshot);
    },
  };
}
