import type { EntityId, TimestampIso } from "@fieldpulse/platform-db";
import type { ScoutNoteOutcome } from "./ScoutNote";

export type CreateScoutNoteInput = {
  workspaceId: EntityId;
  fieldId: EntityId;
  findingId?: EntityId | null;
  zoneId?: EntityId | null;
  cellKey?: string | null;
  outcome: ScoutNoteOutcome;
  noteText: string;
  observedAt?: TimestampIso;
  createdByUserId: string;
};
