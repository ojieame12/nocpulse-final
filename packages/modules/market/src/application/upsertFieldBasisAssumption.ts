import type { FieldBasisAssumption } from "../contracts/FieldBasisAssumption";
import type { FieldBasisAssumptionRepository } from "../contracts/FieldBasisAssumptionRepository";
import type { UpsertFieldBasisAssumptionInput } from "../contracts/UpsertFieldBasisAssumptionInput";

export type UpsertFieldBasisAssumptionUseCaseInput = {
  repository: FieldBasisAssumptionRepository;
  input: UpsertFieldBasisAssumptionInput;
};

export function upsertFieldBasisAssumption(
  input: UpsertFieldBasisAssumptionUseCaseInput,
): Promise<FieldBasisAssumption> {
  return input.repository.upsert(input.input);
}
