import type { EntityId, WorkspaceId } from "@fieldpulse/platform-db";
import type {
  CreateImageryProviderProbeRecordInput,
  ImageryProviderProbeRecord,
} from "./ImageryProviderProbeRecord";

export type ImageryProviderProbeRepository = {
  createMany(
    inputs: readonly CreateImageryProviderProbeRecordInput[],
  ): Promise<readonly ImageryProviderProbeRecord[]>;
  listLatestByField(input: {
    workspaceId: WorkspaceId;
    fieldId: EntityId;
    limit?: number;
  }): Promise<readonly ImageryProviderProbeRecord[]>;
  listRecent(input?: {
    createdAfter?: string;
    limit?: number;
  }): Promise<readonly ImageryProviderProbeRecord[]>;
};
