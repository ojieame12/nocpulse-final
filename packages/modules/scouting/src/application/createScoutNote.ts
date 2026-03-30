import type { ScoutNote } from "../contracts/ScoutNote";
import type { CreateScoutNoteInput } from "../contracts/CreateScoutNoteInput";
import type { ScoutNoteRepository } from "../infrastructure/ScoutNoteRepository";

export type CreateScoutNoteUseCaseInput = {
  repository: ScoutNoteRepository;
  input: CreateScoutNoteInput;
};

export async function createScoutNote(
  input: CreateScoutNoteUseCaseInput,
): Promise<ScoutNote> {
  return input.repository.createNote(input.input);
}
