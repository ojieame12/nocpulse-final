import type { JsonValue, TimestampIso, UserId, WorkspaceId } from "@fieldpulse/platform-db";
import type { AlertFamily, AlertSeverity, AlertStatus } from "./FieldAlert";

export type UpsertFieldAlertInput = {
  workspaceId: WorkspaceId;
  fieldId: string;
  family: AlertFamily;
  severity: AlertSeverity;
  status?: AlertStatus;
  sourceKey: string;
  dedupeKey: string;
  title: string;
  summary?: string | null;
  explanation?: string | null;
  recommendedAction?: string | null;
  facts?: JsonValue;
  evidence?: JsonValue;
  startedAt: TimestampIso;
  endedAt?: TimestampIso | null;
  acknowledgedAt?: TimestampIso | null;
  acknowledgedByUserId?: UserId | null;
  resolvedAt?: TimestampIso | null;
  resolutionNote?: string | null;
};
