import type { TimestampIso, WorkspaceId } from "@fieldpulse/platform-db";
import type { FieldHailEvent } from "./FieldHailEvent";
import type { FieldHailRefreshRun } from "./FieldHailRefreshRun";

export type RefreshFieldHailEventsInput = {
  workspaceId: WorkspaceId;
  fieldId: string;
  requestedAt?: TimestampIso;
  limit?: number;
};

export type RefreshFieldHailEventsResult = {
  workspaceId: WorkspaceId;
  fieldId: string;
  providerKey: FieldHailEvent["providerKey"];
  sourceKey: string;
  requestedAt: TimestampIso;
  run: FieldHailRefreshRun;
  events: readonly FieldHailEvent[];
};
