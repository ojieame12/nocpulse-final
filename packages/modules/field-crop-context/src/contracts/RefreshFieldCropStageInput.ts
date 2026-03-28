import type { EntityId, TimestampIso, WorkspaceId } from "@fieldpulse/platform-db";
import type { FieldCropContext } from "./FieldCropContext";

export type StageProgressionThreshold = {
  stage: string;
  minAccumulatedGdd: number;
};

export type RefreshFieldCropStageInput = {
  workspaceId: WorkspaceId;
  fieldId: EntityId;
  requestedAt: TimestampIso;
  weatherSignalSet: {
    id: EntityId;
    observedAt: TimestampIso;
    gdd24h: number | null;
  };
  thresholds: readonly StageProgressionThreshold[];
  sourceKey?: string;
};

export type RefreshFieldCropStageResult = {
  context: FieldCropContext;
  appliedDailyGdd: number;
  derivedGrowthStage: string;
  updated: boolean;
};
