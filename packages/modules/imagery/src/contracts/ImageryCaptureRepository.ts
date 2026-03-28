import type { EntityId, WorkspaceId } from "@fieldpulse/platform-db";
import type { ImageryCapture, UpsertImageryCaptureInput } from "./ImageryCapture";

export type ImageryCaptureRepository = {
  getLatestByField(
    workspaceId: WorkspaceId,
    fieldId: EntityId,
  ): Promise<ImageryCapture | null>;
  listRecent(input?: {
    workspaceId?: WorkspaceId;
    createdAfter?: string;
    limit?: number;
  }): Promise<readonly ImageryCapture[]>;
  upsertCapture(input: UpsertImageryCaptureInput): Promise<ImageryCapture>;
};
