import type { FieldCropContext } from "../contracts/FieldCropContext";
import type { UpsertFieldCropContextInput } from "../contracts/UpsertFieldCropContextInput";

type UpsertFieldCropContextRepository = {
  upsertContext(
    input: UpsertFieldCropContextInput,
  ): Promise<FieldCropContext>;
};

export type UpsertFieldCropContextUseCaseInput = {
  repository: UpsertFieldCropContextRepository;
  context: UpsertFieldCropContextInput;
};

export async function upsertFieldCropContext(
  input: UpsertFieldCropContextUseCaseInput,
): Promise<FieldCropContext> {
  return input.repository.upsertContext(input.context);
}
