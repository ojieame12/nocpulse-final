import type { WorkspaceId } from "@fieldpulse/platform-db";
import type { FieldSummary } from "../contracts/FieldSummary";

export type FieldSummaryRepository = {
  listByWorkspace(workspaceId: WorkspaceId): Promise<readonly FieldSummary[]>;
};
