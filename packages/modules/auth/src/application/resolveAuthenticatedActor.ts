import type { UserId, WorkspaceId } from "@fieldpulse/platform-db";
import type { WorkspaceRole } from "@fieldpulse/module-workspaces";
import type { AuthenticatedActor } from "../contracts/AuthenticatedActor";

type WorkspaceMembershipRepository = {
  listByUser(userId: UserId): Promise<
    readonly {
      workspaceId: WorkspaceId;
      userId: UserId;
      role: WorkspaceRole;
    }[]
  >;
};

type WorkspaceRepository = {
  getById(workspaceId: WorkspaceId): Promise<{
    id: WorkspaceId;
  } | null>;
};

export type ResolveAuthenticatedActorInput = {
  workspaceMemberships: WorkspaceMembershipRepository;
  workspaces: WorkspaceRepository;
  userId: UserId;
  preferredWorkspaceId?: WorkspaceId;
};

export async function resolveAuthenticatedActor(
  input: ResolveAuthenticatedActorInput,
): Promise<AuthenticatedActor | null> {
  const memberships = await input.workspaceMemberships.listByUser(input.userId);

  if (memberships.length === 0) {
    return null;
  }

  const membership = input.preferredWorkspaceId
    ? memberships.find(
        (candidate) => candidate.workspaceId === input.preferredWorkspaceId,
      ) ?? null
    : memberships[0] ?? null;

  if (!membership) {
    return null;
  }

  const workspace = await input.workspaces.getById(membership.workspaceId);

  if (!workspace) {
    return null;
  }

  return {
    userId: input.userId,
    workspaceId: membership.workspaceId,
    role: membership.role,
  };
}
