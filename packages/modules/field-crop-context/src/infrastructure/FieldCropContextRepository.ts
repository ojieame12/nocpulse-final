import type { EntityId, WorkspaceId } from "@fieldpulse/platform-db";
import type { FieldCropContext } from "../contracts/FieldCropContext";
import type { UpsertFieldCropContextInput } from "../contracts/UpsertFieldCropContextInput";

export type FieldCropContextRepository = {
  getLatestByField(
    workspaceId: WorkspaceId,
    fieldId: EntityId,
  ): Promise<FieldCropContext | null>;
  listLatestByWorkspace(
    workspaceId: WorkspaceId,
  ): Promise<readonly FieldCropContext[]>;
  deleteContext(
    workspaceId: WorkspaceId,
    fieldId: EntityId,
    seasonYear: number,
  ): Promise<void>;
  upsertContext(
    input: UpsertFieldCropContextInput,
  ): Promise<FieldCropContext>;
};
