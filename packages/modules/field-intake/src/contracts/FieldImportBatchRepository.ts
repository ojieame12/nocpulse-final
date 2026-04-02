import type {
  EntityId,
  UserId,
  WorkspaceId,
} from "@fieldpulse/platform-db";
import type {
  FieldImportBatch,
  FieldImportCandidate,
} from "./FieldImportBatch";
import type { SpreadsheetImportPreview } from "./SpreadsheetImport";

export type CreateSpreadsheetImportBatchInput = {
  workspaceId: WorkspaceId;
  preview: SpreadsheetImportPreview;
};

export type FieldImportBatchRepository = {
  findReusableSpreadsheetImportBatch?(
    input: CreateSpreadsheetImportBatchInput,
    actorUserId: UserId,
  ): Promise<{
    batch: FieldImportBatch;
    candidates: readonly FieldImportCandidate[];
  } | null>;
  createSpreadsheetImportBatch(
    input: CreateSpreadsheetImportBatchInput,
    actorUserId: UserId,
  ): Promise<{
    batch: FieldImportBatch;
    candidates: readonly FieldImportCandidate[];
  }>;
  getBatchById(
    workspaceId: WorkspaceId,
    batchId: EntityId,
  ): Promise<FieldImportBatch | null>;
  listCandidatesByBatch(
    workspaceId: WorkspaceId,
    batchId: EntityId,
  ): Promise<readonly FieldImportCandidate[]>;
  getLatestCommittedCandidateByField(
    workspaceId: WorkspaceId,
    fieldId: EntityId,
  ): Promise<FieldImportCandidate | null>;
  markCandidateCommitted(
    workspaceId: WorkspaceId,
    batchId: EntityId,
    candidateId: EntityId,
    input: {
      fieldId: EntityId;
      action: "created" | "reused";
    },
  ): Promise<FieldImportCandidate>;
  markBatchCommitted(
    workspaceId: WorkspaceId,
    batchId: EntityId,
    actorUserId: UserId,
  ): Promise<FieldImportBatch>;
};
