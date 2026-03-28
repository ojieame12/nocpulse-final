import type {
  Audited,
  TimestampIso,
  UserId,
  WorkspaceId,
} from "@fieldpulse/platform-db";

export type WorkspaceRole = "owner" | "manager" | "member" | "viewer";

export type Workspace = Audited & {
  id: WorkspaceId;
  slug: string;
  name: string;
  createdBy: UserId;
};

export type WorkspaceMembership = {
  workspaceId: WorkspaceId;
  userId: UserId;
  role: WorkspaceRole;
  invitedBy: UserId | null;
  createdAt: TimestampIso;
};
