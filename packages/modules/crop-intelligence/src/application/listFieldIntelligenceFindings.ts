import type { FieldIntelligenceFinding } from "../contracts/FieldIntelligenceFinding";
import type { IntelligenceFindingStatus } from "../contracts/IntelligenceFindingFamily";

type ListFieldIntelligenceFindingsRepository = {
  listByField(
    workspaceId: string,
    fieldId: string,
    limit?: number,
    status?: IntelligenceFindingStatus,
  ): Promise<readonly FieldIntelligenceFinding[]>;
};

export type ListFieldIntelligenceFindingsInput = {
  repository: ListFieldIntelligenceFindingsRepository;
  workspaceId: string;
  fieldId: string;
  limit?: number;
  status?: IntelligenceFindingStatus;
};

export async function listFieldIntelligenceFindings(
  input: ListFieldIntelligenceFindingsInput,
): Promise<readonly FieldIntelligenceFinding[]> {
  return input.repository.listByField(
    input.workspaceId,
    input.fieldId,
    input.limit,
    input.status,
  );
}
