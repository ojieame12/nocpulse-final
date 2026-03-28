import type { FieldAlert } from "../contracts/FieldAlert";
import type { AcknowledgeFieldAlertInput } from "../contracts/AcknowledgeFieldAlertInput";

type AcknowledgeFieldAlertRepository = {
  acknowledgeAlert(input: AcknowledgeFieldAlertInput): Promise<FieldAlert | null>;
};

export type AcknowledgeFieldAlertUseCaseInput = {
  repository: AcknowledgeFieldAlertRepository;
  acknowledgement: AcknowledgeFieldAlertInput;
};

export async function acknowledgeFieldAlert(
  input: AcknowledgeFieldAlertUseCaseInput,
): Promise<FieldAlert | null> {
  return input.repository.acknowledgeAlert(input.acknowledgement);
}
