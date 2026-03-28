import type { EntityId, WorkspaceId } from "@fieldpulse/platform-db";
import type {
  FieldMoistureCellSnapshot,
  ReplaceFieldMoistureCellSnapshotsInput,
} from "../contracts/FieldMoistureCellSnapshot";

export type FieldMoistureCellSnapshotRepository = {
  getLatestByField(
    workspaceId: WorkspaceId,
    fieldId: EntityId,
  ): Promise<readonly FieldMoistureCellSnapshot[]>;
  replaceSnapshotCells(
    input: ReplaceFieldMoistureCellSnapshotsInput,
  ): Promise<readonly FieldMoistureCellSnapshot[]>;
};
