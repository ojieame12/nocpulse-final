import type { FieldAlert } from "../contracts/FieldAlert";

type ListFieldAlertsRepository = {
  listByField(
    workspaceId: string,
    fieldId: string,
    limit?: number,
    status?: FieldAlert["status"],
  ): Promise<readonly FieldAlert[]>;
};

export type ListFieldAlertsInput = {
  repository: ListFieldAlertsRepository;
  workspaceId: string;
  fieldId: string;
  limit?: number;
  status?: FieldAlert["status"];
};

export async function listFieldAlerts(
  input: ListFieldAlertsInput,
): Promise<readonly FieldAlert[]> {
  return input.repository.listByField(
    input.workspaceId,
    input.fieldId,
    input.limit,
    input.status,
  );
}
