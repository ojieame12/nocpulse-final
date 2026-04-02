import type { WorkspaceRole } from "@fieldpulse/module-workspaces";

export type WorkspaceInviteRole = Exclude<WorkspaceRole, "owner">;

export type WorkspaceAccessMember = {
  userId: string;
  email: string | null;
  role: WorkspaceRole;
  createdAt: string;
  invitedByUserId: string | null;
  invitedByEmail: string | null;
  isCurrentActor: boolean;
  canChangeRole: boolean;
  canRemove: boolean;
  allowedRoleChanges: readonly WorkspaceInviteRole[];
};

export type WorkspaceAccessState = {
  workspaceId: string;
  workspaceName: string | null;
  actorRole: WorkspaceRole;
  canManageAccess: boolean;
  allowedInviteRoles: readonly WorkspaceInviteRole[];
  members: readonly WorkspaceAccessMember[];
};

const WORKSPACE_INVITE_ROLE_LABELS: Record<WorkspaceInviteRole, string> = {
  manager: "Manager",
  member: "Member",
  viewer: "Viewer",
};

const WORKSPACE_INVITE_ROLE_DESCRIPTIONS: Record<
  WorkspaceInviteRole,
  string
> = {
  manager: "Can manage workspace operations and invite standard members.",
  member: "Can work inside the workspace without changing access rules.",
  viewer: "Read-only access for stakeholders and external collaborators.",
};

export function formatWorkspaceRoleLabel(role: WorkspaceRole) {
  if (role === "owner") {
    return "Owner";
  }

  return WORKSPACE_INVITE_ROLE_LABELS[role];
}

export function canManageWorkspace(role: WorkspaceRole) {
  return role === "owner" || role === "manager";
}

export function listAllowedWorkspaceInviteRoles(
  actorRole: WorkspaceRole,
): readonly WorkspaceInviteRole[] {
  if (actorRole === "owner") {
    return ["manager", "member", "viewer"];
  }

  if (actorRole === "manager") {
    return ["member", "viewer"];
  }

  return [];
}

export function describeWorkspaceInviteRole(role: WorkspaceInviteRole) {
  return WORKSPACE_INVITE_ROLE_DESCRIPTIONS[role];
}

export function listAllowedWorkspaceMemberRoleChanges(
  actorRole: WorkspaceRole,
  targetRole: WorkspaceRole,
  isCurrentActor: boolean,
): readonly WorkspaceInviteRole[] {
  if (isCurrentActor || targetRole === "owner") {
    return [];
  }

  if (actorRole === "owner") {
    return ["manager", "member", "viewer"];
  }

  if (actorRole === "manager") {
    return targetRole === "member" || targetRole === "viewer"
      ? ["member", "viewer"]
      : [];
  }

  return [];
}

export function canRemoveWorkspaceMember(
  actorRole: WorkspaceRole,
  targetRole: WorkspaceRole,
  isCurrentActor: boolean,
) {
  return (
    !isCurrentActor &&
    listAllowedWorkspaceMemberRoleChanges(
      actorRole,
      targetRole,
      isCurrentActor,
    ).length > 0
  );
}

export function canChangeWorkspaceMemberRole(
  actorRole: WorkspaceRole,
  targetRole: WorkspaceRole,
  isCurrentActor: boolean,
) {
  return (
    listAllowedWorkspaceMemberRoleChanges(
      actorRole,
      targetRole,
      isCurrentActor,
    ).length > 0
  );
}

export function normalizeWorkspaceMemberRoleChange(
  input: unknown,
  actorRole: WorkspaceRole,
  targetRole: WorkspaceRole,
  isCurrentActor: boolean,
) {
  const allowed = listAllowedWorkspaceMemberRoleChanges(
    actorRole,
    targetRole,
    isCurrentActor,
  );
  const value =
    typeof input === "string" ? input.trim().toLowerCase() : "";

  if (!allowed.includes(value as WorkspaceInviteRole)) {
    return null;
  }

  return value as WorkspaceInviteRole;
}

export function normalizeWorkspaceInviteRole(
  input: unknown,
  actorRole: WorkspaceRole,
): WorkspaceInviteRole {
  const allowed = listAllowedWorkspaceInviteRoles(actorRole);

  if (allowed.length === 0) {
    return "member";
  }

  const value =
    typeof input === "string" ? input.trim().toLowerCase() : "";

  return allowed.includes(value as WorkspaceInviteRole)
    ? (value as WorkspaceInviteRole)
    : allowed[0];
}

export function normalizeWorkspaceAccessEmail(input: unknown) {
  return typeof input === "string" ? input.trim().toLowerCase() : "";
}

export function isValidWorkspaceAccessEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
