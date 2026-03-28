import type { EntityId, WorkspaceId } from "@fieldpulse/platform-db";
import type { MoistureEstimate } from "../contracts/MoistureEstimate";

export type MoistureEstimateStore = {
  getFieldEstimate(
    workspaceId: WorkspaceId,
    fieldId: EntityId,
  ): Promise<MoistureEstimate | null>;
};
