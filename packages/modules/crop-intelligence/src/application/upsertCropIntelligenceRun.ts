import type { CropIntelligenceRun } from "../contracts/CropIntelligenceRun";
import type { UpsertCropIntelligenceRunInput } from "../contracts/UpsertCropIntelligenceRunInput";

type UpsertCropIntelligenceRunRepository = {
  upsertRun(input: UpsertCropIntelligenceRunInput): Promise<CropIntelligenceRun>;
};

export type UpsertCropIntelligenceRunUseCaseInput = {
  repository: UpsertCropIntelligenceRunRepository;
  run: UpsertCropIntelligenceRunInput;
};

export async function upsertCropIntelligenceRun(
  input: UpsertCropIntelligenceRunUseCaseInput,
): Promise<CropIntelligenceRun> {
  return input.repository.upsertRun(input.run);
}
