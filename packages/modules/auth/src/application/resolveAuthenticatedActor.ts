import type { UserId, WorkspaceId } from "@fieldpulse/platform-db";
import type { WorkspaceRole } from "@fieldpulse/module-workspaces";
import type { AuthenticatedActor } from "../contracts/AuthenticatedActor";

type WorkspaceMembershipRepository = {
  getByWorkspaceAndUser(
    workspaceId: WorkspaceId,
    userId: UserId,
  ): Promise<
    {
      workspaceId: WorkspaceId;
      userId: UserId;
      role: WorkspaceRole;
    } | null
  >;
  listByUser(userId: UserId): Promise<
    readonly {
      workspaceId: WorkspaceId;
      userId: UserId;
      role: WorkspaceRole;
    }[]
  >;
};

export type ResolveAuthenticatedActorInput = {
  workspaceMemberships: WorkspaceMembershipRepository;
  userId: UserId;
  preferredWorkspaceId?: WorkspaceId;
};

export async function resolveAuthenticatedActor(
  input: ResolveAuthenticatedActorInput,
): Promise<AuthenticatedActor | null> {
  if (input.preferredWorkspaceId) {
    const membership = await input.workspaceMemberships.getByWorkspaceAndUser(
      input.preferredWorkspaceId,
      input.userId,
    );

    if (!membership) {
      return null;
    }

    return {
      userId: input.userId,
      workspaceId: membership.workspaceId,
      role: membership.role,
    };
  }

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

  return {
    userId: input.userId,
    workspaceId: membership.workspaceId,
    role: membership.role,
  };
}
