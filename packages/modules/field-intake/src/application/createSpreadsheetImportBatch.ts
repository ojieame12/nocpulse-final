import type { UserId, WorkspaceId } from "@fieldpulse/platform-db";
import type {
  FieldImportBatch,
  FieldImportCandidate,
} from "../contracts/FieldImportBatch";
import type { SpreadsheetImportPreview } from "../contracts/SpreadsheetImport";
import type { FieldImportBatchRepository } from "../contracts/FieldImportBatchRepository";

export type CreateSpreadsheetImportBatchInput = {
  repository: FieldImportBatchRepository;
  actorUserId: UserId;
  workspaceId: WorkspaceId;
  preview: SpreadsheetImportPreview;
};

export type CreateSpreadsheetImportBatchResult = {
  batch: FieldImportBatch;
  candidates: readonly FieldImportCandidate[];
};

export async function createSpreadsheetImportBatch(
  input: CreateSpreadsheetImportBatchInput,
): Promise<CreateSpreadsheetImportBatchResult> {
  return input.repository.createSpreadsheetImportBatch(
    {
      workspaceId: input.workspaceId,
      preview: input.preview,
    },
    input.actorUserId,
  );
}
