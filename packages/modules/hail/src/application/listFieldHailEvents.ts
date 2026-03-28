import type { FieldHailEvent } from "../contracts/FieldHailEvent";

type ListFieldHailEventsRepository = {
  listByField(
    workspaceId: string,
    fieldId: string,
    limit?: number,
    reportedAfter?: string,
  ): Promise<readonly FieldHailEvent[]>;
};

export type ListFieldHailEventsInput = {
  repository: ListFieldHailEventsRepository;
  workspaceId: string;
  fieldId: string;
  limit?: number;
  reportedAfter?: string;
};

export async function listFieldHailEvents(
  input: ListFieldHailEventsInput,
): Promise<readonly FieldHailEvent[]> {
  return input.repository.listByField(
    input.workspaceId,
    input.fieldId,
    input.limit,
    input.reportedAfter,
  );
}
