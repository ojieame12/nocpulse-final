import type { EntityId, UserId, WorkspaceId } from "@fieldpulse/platform-db";
import type { CreateFieldInput } from "../contracts/CreateFieldInput";
import type { FieldDetail } from "../contracts/FieldDetail";
import type { FieldSummary } from "../contracts/FieldSummary";

export type FieldRepository = {
  listByWorkspace(workspaceId: WorkspaceId): Promise<readonly FieldSummary[]>;
  getById(workspaceId: WorkspaceId, fieldId: EntityId): Promise<FieldDetail | null>;
  create(input: CreateFieldInput, actorUserId: UserId): Promise<FieldDetail>;
  renameField(
    workspaceId: WorkspaceId,
    fieldId: EntityId,
    name: string,
  ): Promise<FieldDetail>;
  setLegalLandDescription(
    workspaceId: WorkspaceId,
    fieldId: EntityId,
    legalLandDescription: string | null,
  ): Promise<FieldDetail>;
  deleteField(workspaceId: WorkspaceId, fieldId: EntityId): Promise<void>;
};
