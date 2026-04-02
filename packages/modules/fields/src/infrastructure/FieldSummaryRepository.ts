import type { WorkspaceId } from "@fieldpulse/platform-db";
import type { ArchivedFieldSummary } from "../contracts/ArchivedFieldSummary";
import type { FieldSummary } from "../contracts/FieldSummary";

export type FieldSummaryRepository = {
  listByWorkspace(workspaceId: WorkspaceId): Promise<readonly FieldSummary[]>;
  listArchivedByWorkspace(
    workspaceId: WorkspaceId,
  ): Promise<readonly ArchivedFieldSummary[]>;
};
