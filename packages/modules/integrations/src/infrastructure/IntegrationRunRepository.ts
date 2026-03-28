import type { WorkspaceId } from "@fieldpulse/platform-db";
import type { IntegrationRun } from "../contracts/IntegrationRun";

export type IntegrationRunRepository = {
  listByWorkspace(workspaceId: WorkspaceId): Promise<readonly IntegrationRun[]>;
};
