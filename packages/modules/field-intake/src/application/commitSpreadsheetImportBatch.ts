import type {
  CreateFieldInput,
  EnsureWorkspaceFieldResult,
  FieldSummary,
} from "@fieldpulse/module-fields";
import type { EntityId, UserId, WorkspaceId } from "@fieldpulse/platform-db";
import type {
  FieldImportBatch,
  FieldImportCandidate,
} from "../contracts/FieldImportBatch";
import type { FieldImportBatchRepository } from "../contracts/FieldImportBatchRepository";

type CommittedField = FieldSummary;
type CommitFieldAction = EnsureWorkspaceFieldResult["action"];
type CommitFieldResult = {
  field: CommittedField;
  action: CommitFieldAction;
};

type CommitFieldRepository = {
  create: (
    input: CreateFieldInput,
    actorUserId: UserId,
  ) => Promise<CommittedField>;
  getById: (
    workspaceId: WorkspaceId,
    fieldId: EntityId,
  ) => Promise<CommittedField | null>;
  listOverviewByWorkspace: (
    workspaceId: WorkspaceId,
  ) => Promise<readonly CommittedField[]>;
  setLegalLandDescription?: (
    workspaceId: WorkspaceId,
    fieldId: EntityId,
    legalLandDescription: string | null,
  ) => Promise<CommittedField>;
};

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
    field: CommittedField;
    action: CommitFieldAction;
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

async function ensureWorkspaceFieldFromIndex(input: {
  repository: CommitFieldRepository;
  actorUserId: UserId;
  field: {
    workspaceId: WorkspaceId;
    name: string;
    areaHa: number;
    boundary: CreateFieldInput["boundary"];
    legalLandDescription?: string | null;
  };
  fieldIdByName: Map<string, EntityId>;
  fieldById: Map<EntityId, CommittedField>;
}): Promise<CommitFieldResult> {
  const existingFieldId = input.fieldIdByName.get(input.field.name);

  if (existingFieldId) {
    const cachedDetail = input.fieldById.get(existingFieldId);

    if (cachedDetail) {
      return {
        field: cachedDetail,
        action: "reused",
      };
    }

    const detail = await input.repository.getById(
      input.field.workspaceId,
      existingFieldId,
    );

    if (!detail) {
      throw new Error(
        `[field-intake] could not load detail for existing field ${existingFieldId}`,
      );
    }

    input.fieldById.set(detail.id, detail);

    return {
      field: detail,
      action: "reused",
    };
  }

  const createdField = await input.repository.create(input.field, input.actorUserId);

  input.fieldIdByName.set(createdField.name, createdField.id);
  input.fieldById.set(createdField.id, createdField);

  return {
    field: createdField,
    action: "created",
  };
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
  const existingFields = await input.fieldRepository.listOverviewByWorkspace(
    input.workspaceId,
  );
  const existingFieldIdByName = new Map<string, EntityId>(
    existingFields.map((field) => [field.name, field.id]),
  );
  const fieldById = new Map<EntityId, CommittedField>(
    existingFields.map((field) => [field.id, field]),
  );
  const committedCandidates: Array<{
    candidate: FieldImportCandidate;
    field: CommittedField;
    action: CommitFieldAction;
  }> = [];

  for (const candidate of persistedCandidates) {
    if (candidate.status === "committed" && candidate.committedFieldId) {
      const detail =
        fieldById.get(candidate.committedFieldId) ??
        (await input.fieldRepository.getById(
          input.workspaceId,
          candidate.committedFieldId,
        ));

      if (!detail) {
        throw new Error(
          `[field-intake] committed field ${candidate.committedFieldId} for candidate ${candidate.id} could not be loaded`,
        );
      }

      fieldById.set(detail.id, detail);
      existingFieldIdByName.set(detail.name, detail.id);

      committedCandidates.push({
        candidate,
        field: detail,
        action: candidate.commitAction ?? "reused",
      });
      continue;
    }

    const canonicalLegalLandDescription = resolveCanonicalLegalLandDescription(
      candidate.legalLandDescriptions,
    );
    const fieldResult = await ensureWorkspaceFieldFromIndex({
      repository: input.fieldRepository,
      actorUserId: input.actorUserId,
      field: {
        workspaceId: input.workspaceId,
        ...candidate.draft,
        legalLandDescription: canonicalLegalLandDescription,
      },
      fieldIdByName: existingFieldIdByName,
      fieldById,
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

    const fieldDetail =
      canonicalLegalLandDescription &&
      input.fieldRepository.setLegalLandDescription &&
      fieldResult.field.legalLandDescription !== canonicalLegalLandDescription
        ? await input.fieldRepository.setLegalLandDescription(
            input.workspaceId,
            fieldResult.field.id,
            canonicalLegalLandDescription,
          )
        : fieldResult.field;

    fieldById.set(fieldDetail.id, fieldDetail);
    existingFieldIdByName.set(fieldDetail.name, fieldDetail.id);

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
