import type { FieldBasisAssumption } from "../contracts/FieldBasisAssumption";
import type { UpsertFieldBasisAssumptionInput } from "../contracts/UpsertFieldBasisAssumptionInput";
import type { FieldBasisAssumptionRepository } from "../infrastructure/FieldBasisAssumptionRepository";

export type UpsertFieldBasisAssumptionUseCaseInput = {
  repository: FieldBasisAssumptionRepository;
  input: UpsertFieldBasisAssumptionInput;
};

export function upsertFieldBasisAssumption(
  input: UpsertFieldBasisAssumptionUseCaseInput,
): Promise<FieldBasisAssumption> {
  return input.repository.upsert(input.input);
}
