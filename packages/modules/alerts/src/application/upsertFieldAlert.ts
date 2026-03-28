import type { FieldAlert } from "../contracts/FieldAlert";
import type { UpsertFieldAlertInput } from "../contracts/UpsertFieldAlertInput";

type UpsertFieldAlertRepository = {
  upsertAlert(input: UpsertFieldAlertInput): Promise<FieldAlert>;
};

export type UpsertFieldAlertUseCaseInput = {
  repository: UpsertFieldAlertRepository;
  alert: UpsertFieldAlertInput;
};

export async function upsertFieldAlert(
  input: UpsertFieldAlertUseCaseInput,
): Promise<FieldAlert> {
  return input.repository.upsertAlert(input.alert);
}
