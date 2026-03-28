import type { FieldHailEvent } from "../contracts/FieldHailEvent";
import type { UpsertFieldHailEventInput } from "../contracts/UpsertFieldHailEventInput";

type UpsertFieldHailEventRepository = {
  upsertEvent(input: UpsertFieldHailEventInput): Promise<FieldHailEvent>;
};

export type UpsertFieldHailEventUseCaseInput = {
  repository: UpsertFieldHailEventRepository;
  event: UpsertFieldHailEventInput;
};

export async function upsertFieldHailEvent(
  input: UpsertFieldHailEventUseCaseInput,
): Promise<FieldHailEvent> {
  return input.repository.upsertEvent(input.event);
}
