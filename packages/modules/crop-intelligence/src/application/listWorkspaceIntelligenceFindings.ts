import type { FieldIntelligenceFinding } from "../contracts/FieldIntelligenceFinding";
import type {
  IntelligenceFindingFamily,
  IntelligenceFindingStatus,
} from "../contracts/IntelligenceFindingFamily";

type ListWorkspaceIntelligenceFindingsRepository = {
  listRecentByWorkspace(input: {
    workspaceId: string;
    limit?: number;
    status?: IntelligenceFindingStatus;
    family?: IntelligenceFindingFamily;
    updatedAfter?: string;
  }): Promise<readonly FieldIntelligenceFinding[]>;
};

export type ListWorkspaceIntelligenceFindingsInput = {
  repository: ListWorkspaceIntelligenceFindingsRepository;
  workspaceId: string;
  limit?: number;
  status?: IntelligenceFindingStatus;
  family?: IntelligenceFindingFamily;
  updatedAfter?: string;
};

export async function listWorkspaceIntelligenceFindings(
  input: ListWorkspaceIntelligenceFindingsInput,
): Promise<readonly FieldIntelligenceFinding[]> {
  return input.repository.listRecentByWorkspace({
    workspaceId: input.workspaceId,
    limit: input.limit,
    status: input.status,
    family: input.family,
    updatedAfter: input.updatedAfter,
  });
}
