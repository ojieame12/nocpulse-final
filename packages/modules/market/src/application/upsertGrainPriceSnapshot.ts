import type { GrainPriceSnapshot } from "../contracts/GrainPriceSnapshot";
import type { UpsertGrainPriceSnapshotInput } from "../contracts/UpsertGrainPriceSnapshotInput";
import type { GrainPriceSnapshotRepository } from "../infrastructure/GrainPriceSnapshotRepository";

export type UpsertGrainPriceSnapshotUseCaseInput = {
  repository: GrainPriceSnapshotRepository;
  input: UpsertGrainPriceSnapshotInput;
};

export function upsertGrainPriceSnapshot(
  input: UpsertGrainPriceSnapshotUseCaseInput,
): Promise<GrainPriceSnapshot> {
  return input.repository.upsert(input.input);
}
