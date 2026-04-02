import type { ScoutNote } from "../contracts/ScoutNote";
import type { ScoutNoteRepository } from "../contracts/ScoutNoteRepository";
import type { CreateScoutNoteInput } from "../contracts/CreateScoutNoteInput";

export type CreateScoutNoteUseCaseInput = {
  repository: ScoutNoteRepository;
  input: CreateScoutNoteInput;
};

export async function createScoutNote(
  input: CreateScoutNoteUseCaseInput,
): Promise<ScoutNote> {
  return input.repository.createNote(input.input);
}
