import type { WorkspaceRole } from "@fieldpulse/module-workspaces";
import type { UserId, WorkspaceId } from "@fieldpulse/platform-db";

export type AuthenticatedActor = {
  userId: UserId;
  workspaceId: WorkspaceId;
  role: WorkspaceRole;
};
