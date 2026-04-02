import type { FieldYieldAssumption } from "../contracts/FieldYieldAssumption";
import type { FieldYieldAssumptionRepository } from "../contracts/FieldYieldAssumptionRepository";
import type { UpsertFieldYieldAssumptionInput } from "../contracts/UpsertFieldYieldAssumptionInput";

export type UpsertFieldYieldAssumptionUseCaseInput = {
  repository: FieldYieldAssumptionRepository;
  input: UpsertFieldYieldAssumptionInput;
};

export function upsertFieldYieldAssumption(
  input: UpsertFieldYieldAssumptionUseCaseInput,
): Promise<FieldYieldAssumption> {
  return input.repository.upsert(input.input);
}
