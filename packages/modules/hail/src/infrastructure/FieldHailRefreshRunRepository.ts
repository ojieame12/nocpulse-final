import type { WorkspaceId } from "@fieldpulse/platform-db";
import type { FieldHailRefreshRun } from "../contracts/FieldHailRefreshRun";
import type { UpsertFieldHailRefreshRunInput } from "../contracts/UpsertFieldHailRefreshRunInput";

export type FieldHailRefreshRunRepository = {
  listLatestByWorkspace(
    workspaceId: WorkspaceId,
  ): Promise<readonly FieldHailRefreshRun[]>;
  listRecentRuns(input: {
    workspaceId?: WorkspaceId;
    requestedAfter?: string;
    limit?: number;
  }): Promise<readonly FieldHailRefreshRun[]>;
  upsertRun(
    input: UpsertFieldHailRefreshRunInput,
  ): Promise<FieldHailRefreshRun>;
};
