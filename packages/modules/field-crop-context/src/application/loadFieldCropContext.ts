import type { EntityId, WorkspaceId } from "@fieldpulse/platform-db";
import type { FieldCropContext } from "../contracts/FieldCropContext";

type LoadFieldCropContextRepository = {
  getLatestByField(
    workspaceId: WorkspaceId,
    fieldId: EntityId,
  ): Promise<FieldCropContext | null>;
};

export type LoadFieldCropContextInput = {
  repository: LoadFieldCropContextRepository;
  workspaceId: WorkspaceId;
  fieldId: EntityId;
};

export async function loadFieldCropContext(
  input: LoadFieldCropContextInput,
): Promise<FieldCropContext | null> {
  return input.repository.getLatestByField(input.workspaceId, input.fieldId);
}
