import type { EntityId, WorkspaceId } from "@fieldpulse/platform-db";
import type { FieldMoistureSnapshot } from "../contracts/FieldMoistureSnapshot";
import type { UpsertFieldMoistureSnapshotInput } from "../contracts/UpsertFieldMoistureSnapshotInput";

export type FieldMoistureSnapshotRepository = {
  getLatestByField(
    workspaceId: WorkspaceId,
    fieldId: EntityId,
  ): Promise<FieldMoistureSnapshot | null>;
  upsertSnapshot(input: UpsertFieldMoistureSnapshotInput): Promise<FieldMoistureSnapshot>;
};
