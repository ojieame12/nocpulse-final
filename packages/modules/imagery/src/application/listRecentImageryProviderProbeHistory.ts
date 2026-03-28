import type { TimestampIso } from "@fieldpulse/platform-db";
import type { ImageryProviderProbeRecord } from "../contracts/ImageryProviderProbeRecord";
import type { ImageryProviderProbeRepository } from "../contracts/ImageryProviderProbeRepository";

export type ListRecentImageryProviderProbeHistoryInput = {
  createdAfter?: TimestampIso;
  limit?: number;
};

export async function listRecentImageryProviderProbeHistory(
  repository: ImageryProviderProbeRepository,
  input: ListRecentImageryProviderProbeHistoryInput = {},
): Promise<readonly ImageryProviderProbeRecord[]> {
  return repository.listRecent(input);
}
