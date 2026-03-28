import type { WorkspaceId } from "@fieldpulse/platform-db";
import type { AcknowledgeFieldAlertInput } from "../contracts/AcknowledgeFieldAlertInput";
import type { AlertSummary } from "../contracts/AlertSummary";
import type { FieldAlert } from "../contracts/FieldAlert";
import type { ResolveFieldAlertInput } from "../contracts/ResolveFieldAlertInput";
import type { UpsertFieldAlertInput } from "../contracts/UpsertFieldAlertInput";

export type AlertRepository = {
  listActive(
    workspaceId: WorkspaceId,
    limit?: number,
  ): Promise<readonly AlertSummary[]>;
  listByField(
    workspaceId: WorkspaceId,
    fieldId: string,
    limit?: number,
    status?: FieldAlert["status"],
  ): Promise<readonly FieldAlert[]>;
  upsertAlert(input: UpsertFieldAlertInput): Promise<FieldAlert>;
  acknowledgeAlert(
    input: AcknowledgeFieldAlertInput,
  ): Promise<FieldAlert | null>;
  resolveAlert(
    input: ResolveFieldAlertInput,
  ): Promise<FieldAlert | null>;
};
