import type { EntityId, TimestampIso, WorkspaceId } from "@fieldpulse/platform-db";
import type { FieldCropContext } from "../contracts/FieldCropContext";
import type { StageProgressionThreshold } from "../contracts/RefreshFieldCropStageInput";
import type { UpsertFieldCropContextInput } from "../contracts/UpsertFieldCropContextInput";
import { deriveGrowthStageFromAccumulatedGdd } from "../domain/deriveGrowthStageFromAccumulatedGdd";

type ClearFieldGrowthStageOverrideRepository = {
  getLatestByField(
    workspaceId: WorkspaceId,
    fieldId: EntityId,
  ): Promise<FieldCropContext | null>;
  upsertContext(
    input: UpsertFieldCropContextInput,
  ): Promise<FieldCropContext>;
};

export type ClearFieldGrowthStageOverrideInput = {
  repository: ClearFieldGrowthStageOverrideRepository;
  workspaceId: WorkspaceId;
  fieldId: EntityId;
  requestedAt: TimestampIso;
  thresholds: readonly StageProgressionThreshold[];
  sourceKey?: string;
};

export async function clearFieldGrowthStageOverride(
  input: ClearFieldGrowthStageOverrideInput,
): Promise<FieldCropContext | null> {
  const current = await input.repository.getLatestByField(
    input.workspaceId,
    input.fieldId,
  );

  if (!current) {
    return null;
  }

  if (current.growthStageSource !== "manual") {
    return current;
  }

  const derivedGrowthStage = deriveGrowthStageFromAccumulatedGdd(
    current.accumulatedGdd,
    input.thresholds,
  );

  return input.repository.upsertContext({
    workspaceId: current.workspaceId,
    fieldId: current.fieldId,
    seasonYear: current.seasonYear,
    cropType: current.cropType,
    growthStage: derivedGrowthStage,
    growthStageSource: "derived",
    accumulatedGdd: current.accumulatedGdd,
    lastGddObservedOn: current.lastGddObservedOn,
    lastWeatherSignalSetId: current.lastWeatherSignalSetId,
    lastStageUpdatedAt: input.requestedAt,
    sourceKey: input.sourceKey ?? "field-crop-context:clear-manual-override",
    metadata: {
      ...(typeof current.metadata === "object" &&
      current.metadata !== null &&
      !Array.isArray(current.metadata)
        ? current.metadata
        : {}),
      manualOverrideClearedAt: input.requestedAt,
      lastDerivedGrowthStage: derivedGrowthStage,
    },
  });
}
