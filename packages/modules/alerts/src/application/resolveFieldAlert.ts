import type { FieldAlert } from "../contracts/FieldAlert";
import type { ResolveFieldAlertInput } from "../contracts/ResolveFieldAlertInput";

type ResolveFieldAlertRepository = {
  resolveAlert(input: ResolveFieldAlertInput): Promise<FieldAlert | null>;
};

export type ResolveFieldAlertUseCaseInput = {
  repository: ResolveFieldAlertRepository;
  resolution: ResolveFieldAlertInput;
};

export async function resolveFieldAlert(
  input: ResolveFieldAlertUseCaseInput,
): Promise<FieldAlert | null> {
  return input.repository.resolveAlert(input.resolution);
}
