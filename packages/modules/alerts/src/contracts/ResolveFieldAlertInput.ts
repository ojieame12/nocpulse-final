import type { TimestampIso, UserId, WorkspaceId } from "@fieldpulse/platform-db";

export type ResolveFieldAlertInput = {
  workspaceId: WorkspaceId;
  alertId: string;
  resolvedAt?: TimestampIso;
  resolutionNote?: string | null;
  actorUserId?: UserId | null;
  status?: "resolved" | "dismissed";
};
