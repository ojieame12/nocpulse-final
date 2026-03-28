import type { EntityId, JsonValue, WorkspaceId } from "@fieldpulse/platform-db";
import type { FieldGrowthStageSource } from "./FieldCropContext";

export type UpsertFieldCropContextInput = {
  workspaceId: WorkspaceId;
  fieldId: EntityId;
  seasonYear: number;
  cropType: string;
  growthStage?: string | null;
  growthStageSource?: FieldGrowthStageSource;
  accumulatedGdd?: number;
  lastGddObservedOn?: string | null;
  lastWeatherSignalSetId?: EntityId | null;
  lastStageUpdatedAt?: string | null;
  sourceKey: string;
  metadata?: JsonValue;
};
