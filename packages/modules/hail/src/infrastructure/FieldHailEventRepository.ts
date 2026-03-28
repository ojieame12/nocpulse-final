import type { FieldHailEvent } from "../contracts/FieldHailEvent";
import type { UpsertFieldHailEventInput } from "../contracts/UpsertFieldHailEventInput";

export type FieldHailEventRepository = {
  upsertEvent(input: UpsertFieldHailEventInput): Promise<FieldHailEvent>;
  listByField(
    workspaceId: string,
    fieldId: string,
    limit?: number,
    reportedAfter?: string,
  ): Promise<readonly FieldHailEvent[]>;
  listRecentByWorkspace(
    workspaceId: string,
    limit?: number,
    reportedAfter?: string,
  ): Promise<readonly FieldHailEvent[]>;
};
