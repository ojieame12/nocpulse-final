import type { WorkspaceId } from "@fieldpulse/platform-db";
import type { ScoutNote } from "../contracts/ScoutNote";
import type { ScoutNoteRepository } from "../infrastructure/ScoutNoteRepository";

export type ListFieldScoutNotesInput = {
  repository: ScoutNoteRepository;
  workspaceId: WorkspaceId;
  fieldId: string;
  limit?: number;
};

export async function listFieldScoutNotes(
  input: ListFieldScoutNotesInput,
): Promise<readonly ScoutNote[]> {
  return input.repository.listByField(input.workspaceId, input.fieldId, input.limit);
}
