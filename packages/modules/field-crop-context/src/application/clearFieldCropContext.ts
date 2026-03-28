import type { EntityId, WorkspaceId } from "@fieldpulse/platform-db";

type ClearFieldCropContextRepository = {
  deleteContext(
    workspaceId: WorkspaceId,
    fieldId: EntityId,
    seasonYear: number,
  ): Promise<void>;
};

export type ClearFieldCropContextInput = {
  repository: ClearFieldCropContextRepository;
  workspaceId: WorkspaceId;
  fieldId: EntityId;
  seasonYear: number;
};

export async function clearFieldCropContext(
  input: ClearFieldCropContextInput,
): Promise<void> {
  await input.repository.deleteContext(
    input.workspaceId,
    input.fieldId,
    input.seasonYear,
  );
}
