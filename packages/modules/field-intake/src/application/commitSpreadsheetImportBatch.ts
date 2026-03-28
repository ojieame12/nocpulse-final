import {
  ensureWorkspaceField,
  type EnsureWorkspaceFieldResult,
} from "@fieldpulse/module-fields";
import type { EntityId, UserId, WorkspaceId } from "@fieldpulse/platform-db";
import type {
  FieldImportBatch,
  FieldImportCandidate,
} from "../contracts/FieldImportBatch";
import type { FieldImportBatchRepository } from "../contracts/FieldImportBatchRepository";

type CommitFieldRepository = Parameters<typeof ensureWorkspaceField>[0]["repository"];

export type CommitSpreadsheetImportBatchInput = {
  repository: FieldImportBatchRepository;
  fieldRepository: CommitFieldRepository;
  actorUserId: UserId;
  workspaceId: WorkspaceId;
  batchId: EntityId;
};

export type CommitSpreadsheetImportBatchResult = {
  batch: FieldImportBatch;
  candidates: readonly {
    candidate: FieldImportCandidate;
    field: EnsureWorkspaceFieldResult["field"];
    action: EnsureWorkspaceFieldResult["action"];
  }[];
};

function resolveCanonicalLegalLandDescription(
  values: readonly string[],
): string | null {
  if (values.length === 0) {
    return null;
  }

  return values.join(", ");
}

export async function commitSpreadsheetImportBatch(
  input: CommitSpreadsheetImportBatchInput,
): Promise<CommitSpreadsheetImportBatchResult> {
  const batch = await input.repository.getBatchById(
    input.workspaceId,
    input.batchId,
  );

  if (!batch) {
    throw new Error(
      `[field-intake] import batch ${input.batchId} was not found in workspace ${input.workspaceId}`,
    );
  }

  const persistedCandidates = await input.repository.listCandidatesByBatch(
    input.workspaceId,
    input.batchId,
  );
  const committedCandidates: Array<{
    candidate: FieldImportCandidate;
    field: EnsureWorkspaceFieldResult["field"];
    action: EnsureWorkspaceFieldResult["action"];
  }> = [];

  for (const candidate of persistedCandidates) {
    if (candidate.status === "committed" && candidate.committedFieldId) {
      const detail = await input.fieldRepository.getById(
        input.workspaceId,
        candidate.committedFieldId,
      );

      if (!detail) {
        throw new Error(
          `[field-intake] committed field ${candidate.committedFieldId} for candidate ${candidate.id} could not be loaded`,
        );
      }

      committedCandidates.push({
        candidate,
        field: detail,
        action: candidate.commitAction ?? "reused",
      });
      continue;
    }

    const fieldResult = await ensureWorkspaceField({
      repository: input.fieldRepository,
      actorUserId: input.actorUserId,
      field: {
        workspaceId: input.workspaceId,
        ...candidate.draft,
      },
    });

    const updatedCandidate = await input.repository.markCandidateCommitted(
      input.workspaceId,
      input.batchId,
      candidate.id,
      {
        fieldId: fieldResult.field.id,
        action: fieldResult.action,
      },
    );

    const canonicalLegalLandDescription = resolveCanonicalLegalLandDescription(
      updatedCandidate.legalLandDescriptions,
    );

    const fieldDetail =
      canonicalLegalLandDescription && input.fieldRepository.setLegalLandDescription
        ? await input.fieldRepository.setLegalLandDescription(
            input.workspaceId,
            fieldResult.field.id,
            canonicalLegalLandDescription,
          )
        : fieldResult.field;

    committedCandidates.push({
      candidate: updatedCandidate,
      field: fieldDetail,
      action: fieldResult.action,
    });
  }

  const committedBatch =
    batch.status === "committed"
      ? batch
      : await input.repository.markBatchCommitted(
          input.workspaceId,
          input.batchId,
          input.actorUserId,
        );

  return {
    batch: committedBatch,
    candidates: committedCandidates,
  };
}
