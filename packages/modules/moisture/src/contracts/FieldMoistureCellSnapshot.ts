import type {
  EntityId,
  TimestampIso,
  WorkspaceScoped,
} from "@fieldpulse/platform-db";
import type { MoistureConfidence } from "./MoistureEstimate";

export type MoistureCellPoint = readonly [longitude: number, latitude: number];

export type MoistureCellPolygon = {
  type: "Polygon";
  coordinates: readonly (readonly MoistureCellPoint[])[];
};

export type FieldMoistureCellSnapshot = WorkspaceScoped & {
  id: EntityId;
  fieldId: EntityId;
  snapshotId: EntityId;
  observedAt: TimestampIso;
  sourceKey: string;
  cellKey: string;
  rowIndex: number;
  columnIndex: number;
  centroid: MoistureCellPoint;
  boundary: MoistureCellPolygon;
  rootZonePct: number;
  surfacePct: number;
  confidence: MoistureConfidence;
  createdAt: TimestampIso;
};

export type ReplaceFieldMoistureCellSnapshotsInput = {
  workspaceId: EntityId;
  fieldId: EntityId;
  snapshotId: EntityId;
  observedAt: TimestampIso;
  sourceKey: string;
  confidence: MoistureConfidence;
  cells: readonly {
    cellKey: string;
    rowIndex: number;
    columnIndex: number;
    centroid: MoistureCellPoint;
    boundary: MoistureCellPolygon;
    rootZonePct: number;
    surfacePct: number;
  }[];
};
