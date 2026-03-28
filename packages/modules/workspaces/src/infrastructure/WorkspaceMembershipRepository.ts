import type { UserId, WorkspaceId } from "@fieldpulse/platform-db";
import type { WorkspaceMembership } from "../contracts/workspace";

export type WorkspaceMembershipRepository = {
  listByWorkspace(workspaceId: WorkspaceId): Promise<readonly WorkspaceMembership[]>;
  listByUser(userId: UserId): Promise<readonly WorkspaceMembership[]>;
  addMembership(membership: WorkspaceMembership): Promise<WorkspaceMembership>;
  isMember(workspaceId: WorkspaceId, userId: UserId): Promise<boolean>;
};
