import type { EntityId, WorkspaceId } from "@fieldpulse/platform-db";
import type { ImageryProviderProbeRecord } from "../contracts/ImageryProviderProbeRecord";
import type { ImageryProviderProbeRepository } from "../contracts/ImageryProviderProbeRepository";

export async function listImageryProviderProbeHistory(
  repository: ImageryProviderProbeRepository,
  input: {
    workspaceId: WorkspaceId;
    fieldId: EntityId;
    limit?: number;
  },
): Promise<readonly ImageryProviderProbeRecord[]> {
  return repository.listLatestByField(input);
}
