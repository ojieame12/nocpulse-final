import type { FieldHailEvent } from "../contracts/FieldHailEvent";

type ListWorkspaceHailEventsRepository = {
  listRecentByWorkspace(
    workspaceId: string,
    limit?: number,
    reportedAfter?: string,
  ): Promise<readonly FieldHailEvent[]>;
};

export type ListWorkspaceHailEventsInput = {
  repository: ListWorkspaceHailEventsRepository;
  workspaceId: string;
  limit?: number;
  reportedAfter?: string;
};

export async function listWorkspaceHailEvents(
  input: ListWorkspaceHailEventsInput,
): Promise<readonly FieldHailEvent[]> {
  return input.repository.listRecentByWorkspace(
    input.workspaceId,
    input.limit,
    input.reportedAfter,
  );
}
