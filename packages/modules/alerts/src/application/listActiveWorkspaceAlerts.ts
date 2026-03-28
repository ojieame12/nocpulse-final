import type { AlertSummary } from "../contracts/AlertSummary";

type ListActiveWorkspaceAlertsRepository = {
  listActive(workspaceId: string, limit?: number): Promise<readonly AlertSummary[]>;
};

export type ListActiveWorkspaceAlertsInput = {
  repository: ListActiveWorkspaceAlertsRepository;
  workspaceId: string;
  limit?: number;
};

export async function listActiveWorkspaceAlerts(
  input: ListActiveWorkspaceAlertsInput,
): Promise<readonly AlertSummary[]> {
  return input.repository.listActive(input.workspaceId, input.limit);
}
