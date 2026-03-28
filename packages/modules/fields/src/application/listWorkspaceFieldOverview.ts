import type { WorkspaceId } from "@fieldpulse/platform-db";
import type { FieldOverview } from "../contracts/FieldOverview";

type ListWorkspaceFieldOverviewRepository = {
  listOverviewByWorkspace(workspaceId: WorkspaceId): Promise<readonly FieldOverview[]>;
};

export type ListWorkspaceFieldOverviewInput = {
  repository: ListWorkspaceFieldOverviewRepository;
  workspaceId: WorkspaceId;
};

export async function listWorkspaceFieldOverview(
  input: ListWorkspaceFieldOverviewInput,
): Promise<readonly FieldOverview[]> {
  return input.repository.listOverviewByWorkspace(input.workspaceId);
}
