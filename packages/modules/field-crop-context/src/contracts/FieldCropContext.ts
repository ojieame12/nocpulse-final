import type {
  EntityId,
  JsonValue,
  TimestampIso,
  WorkspaceScoped,
} from "@fieldpulse/platform-db";

export type FieldGrowthStageSource =
  | "defaulted"
  | "imported"
  | "derived"
  | "manual";

export type FieldCropContext = WorkspaceScoped & {
  id: EntityId;
  fieldId: EntityId;
  seasonYear: number;
  cropType: string;
  growthStage: string | null;
  growthStageSource: FieldGrowthStageSource;
  accumulatedGdd: number;
  lastGddObservedOn: string | null;
  lastWeatherSignalSetId: EntityId | null;
  lastStageUpdatedAt: TimestampIso | null;
  sourceKey: string;
  metadata: JsonValue;
  createdAt: TimestampIso;
  updatedAt: TimestampIso;
};
