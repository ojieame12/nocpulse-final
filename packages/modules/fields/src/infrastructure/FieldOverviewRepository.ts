import type { WorkspaceId } from "@fieldpulse/platform-db";
import type { FieldOverview } from "../contracts/FieldOverview";

export type FieldOverviewRepository = {
  listOverviewByWorkspace(workspaceId: WorkspaceId): Promise<readonly FieldOverview[]>;
};
