import type { GrainPriceSnapshot } from "../contracts/GrainPriceSnapshot";
import type { GrainPriceSnapshotRepository } from "../contracts/GrainPriceSnapshotRepository";
import type { UpsertGrainPriceSnapshotInput } from "../contracts/UpsertGrainPriceSnapshotInput";

export type UpsertGrainPriceSnapshotUseCaseInput = {
  repository: GrainPriceSnapshotRepository;
  input: UpsertGrainPriceSnapshotInput;
};

export function upsertGrainPriceSnapshot(
  input: UpsertGrainPriceSnapshotUseCaseInput,
): Promise<GrainPriceSnapshot> {
  return input.repository.upsert(input.input);
}
