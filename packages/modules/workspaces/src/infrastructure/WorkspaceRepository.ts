import type { UserId, WorkspaceId } from "@fieldpulse/platform-db";
import type { CreateWorkspaceInput } from "../contracts/CreateWorkspaceInput";
import type { Workspace } from "../contracts/workspace";

export type WorkspaceRepository = {
  create(input: CreateWorkspaceInput, actorUserId: UserId): Promise<Workspace>;
  getById(workspaceId: WorkspaceId): Promise<Workspace | null>;
  listAll(): Promise<readonly Workspace[]>;
  listByUser(userId: UserId): Promise<readonly Workspace[]>;
};
