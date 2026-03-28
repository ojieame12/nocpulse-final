import type { EntityId, TimestampIso, WorkspaceId } from "@fieldpulse/platform-db";
import type { FieldCropContext } from "../contracts/FieldCropContext";
import type { UpsertFieldCropContextInput } from "../contracts/UpsertFieldCropContextInput";

type SetFieldGrowthStageOverrideRepository = {
  getLatestByField(
    workspaceId: WorkspaceId,
    fieldId: EntityId,
  ): Promise<FieldCropContext | null>;
  upsertContext(
    input: UpsertFieldCropContextInput,
  ): Promise<FieldCropContext>;
};

export type SetFieldGrowthStageOverrideInput = {
  repository: SetFieldGrowthStageOverrideRepository;
  workspaceId: WorkspaceId;
  fieldId: EntityId;
  growthStage: string;
  requestedAt: TimestampIso;
  sourceKey?: string;
};

export async function setFieldGrowthStageOverride(
  input: SetFieldGrowthStageOverrideInput,
): Promise<FieldCropContext> {
  const current = await input.repository.getLatestByField(
    input.workspaceId,
    input.fieldId,
  );

  if (!current) {
    throw new Error(
      `[field-crop-context] no crop context exists for field ${input.fieldId} in workspace ${input.workspaceId}`,
    );
  }

  return input.repository.upsertContext({
    workspaceId: current.workspaceId,
    fieldId: current.fieldId,
    seasonYear: current.seasonYear,
    cropType: current.cropType,
    growthStage: input.growthStage,
    growthStageSource: "manual",
    accumulatedGdd: current.accumulatedGdd,
    lastGddObservedOn: current.lastGddObservedOn,
    lastWeatherSignalSetId: current.lastWeatherSignalSetId,
    lastStageUpdatedAt: input.requestedAt,
    sourceKey: input.sourceKey ?? "field-crop-context:manual-override",
    metadata: {
      ...(typeof current.metadata === "object" &&
      current.metadata !== null &&
      !Array.isArray(current.metadata)
        ? current.metadata
        : {}),
      manualOverrideAppliedAt: input.requestedAt,
      manualOverrideGrowthStage: input.growthStage,
    },
  });
}
