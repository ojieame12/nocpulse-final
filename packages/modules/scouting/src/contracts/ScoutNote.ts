import type {
  Audited,
  EntityId,
  TimestampIso,
  WorkspaceScoped,
} from "@fieldpulse/platform-db";

export type ScoutNoteOutcome =
  | "confirmed"
  | "not_confirmed"
  | "resolved"
  | "monitor";

export type ScoutNote = WorkspaceScoped &
  Audited & {
    id: EntityId;
    fieldId: EntityId;
    findingId: EntityId | null;
    zoneId: EntityId | null;
    cellKey: string | null;
    outcome: ScoutNoteOutcome;
    noteText: string;
    observedAt: TimestampIso;
    createdByUserId: string;
  };
