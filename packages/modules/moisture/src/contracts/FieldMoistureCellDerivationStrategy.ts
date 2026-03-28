import type { EntityId, WorkspaceId } from "@fieldpulse/platform-db";
import type {
  FieldMoistureCellSnapshot,
  MoistureCellPoint,
} from "./FieldMoistureCellSnapshot";
import type { FieldMoistureSnapshot } from "./FieldMoistureSnapshot";

export type MoistureCellFieldBoundary = {
  type: "MultiPolygon";
  coordinates: readonly (readonly (readonly MoistureCellPoint[])[])[];
};

export type FieldMoistureCellDerivationInput = {
  workspaceId: WorkspaceId;
  fieldId: EntityId;
  boundary: MoistureCellFieldBoundary;
  snapshot: FieldMoistureSnapshot;
};

export type DerivedFieldMoistureCell = {
  cellKey: string;
  rowIndex: number;
  columnIndex: number;
  centroid: MoistureCellPoint;
  boundary: FieldMoistureCellSnapshot["boundary"];
  rootZonePct: number;
  surfacePct: number;
};

export type FieldMoistureCellDerivationResult = {
  strategyKey: string;
  cells: readonly DerivedFieldMoistureCell[];
};

export type FieldMoistureCellDerivationStrategy = {
  deriveCells(
    input: FieldMoistureCellDerivationInput,
  ): Promise<FieldMoistureCellDerivationResult> | FieldMoistureCellDerivationResult;
};
