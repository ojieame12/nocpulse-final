import type { WorkspaceId } from "@fieldpulse/platform-db";
import type { CreateScoutNoteInput } from "./CreateScoutNoteInput";
import type { ScoutNote } from "./ScoutNote";

export type ScoutNoteRepository = {
  listByField(
    workspaceId: WorkspaceId,
    fieldId: string,
    limit?: number,
  ): Promise<readonly ScoutNote[]>;
  createNote(input: CreateScoutNoteInput): Promise<ScoutNote>;
};
