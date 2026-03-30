import type { FieldYieldAssumption } from "../contracts/FieldYieldAssumption";
import type { UpsertFieldYieldAssumptionInput } from "../contracts/UpsertFieldYieldAssumptionInput";
import type { FieldYieldAssumptionRepository } from "../infrastructure/FieldYieldAssumptionRepository";

export type UpsertFieldYieldAssumptionUseCaseInput = {
  repository: FieldYieldAssumptionRepository;
  input: UpsertFieldYieldAssumptionInput;
};

export function upsertFieldYieldAssumption(
  input: UpsertFieldYieldAssumptionUseCaseInput,
): Promise<FieldYieldAssumption> {
  return input.repository.upsert(input.input);
}
