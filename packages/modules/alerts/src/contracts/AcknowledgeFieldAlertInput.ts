import type { TimestampIso, UserId, WorkspaceId } from "@fieldpulse/platform-db";

export type AcknowledgeFieldAlertInput = {
  workspaceId: WorkspaceId;
  alertId: string;
  acknowledgedByUserId: UserId;
  acknowledgedAt?: TimestampIso;
};
