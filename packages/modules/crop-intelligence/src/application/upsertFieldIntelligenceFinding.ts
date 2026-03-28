import type { FieldIntelligenceFinding } from "../contracts/FieldIntelligenceFinding";
import type { UpsertFieldIntelligenceFindingInput } from "../contracts/UpsertFieldIntelligenceFindingInput";

type UpsertFieldIntelligenceFindingRepository = {
  upsertFinding(
    input: UpsertFieldIntelligenceFindingInput,
  ): Promise<FieldIntelligenceFinding>;
};

export type UpsertFieldIntelligenceFindingUseCaseInput = {
  repository: UpsertFieldIntelligenceFindingRepository;
  finding: UpsertFieldIntelligenceFindingInput;
};

export async function upsertFieldIntelligenceFinding(
  input: UpsertFieldIntelligenceFindingUseCaseInput,
): Promise<FieldIntelligenceFinding> {
  return input.repository.upsertFinding(input.finding);
}
