import type { FieldCropContext } from "../contracts/FieldCropContext";
import type {
  RefreshFieldCropStageInput,
  RefreshFieldCropStageResult,
} from "../contracts/RefreshFieldCropStageInput";
import type { UpsertFieldCropContextInput } from "../contracts/UpsertFieldCropContextInput";
import { deriveGrowthStageFromAccumulatedGdd } from "../domain/deriveGrowthStageFromAccumulatedGdd";

type RefreshFieldCropStageRepository = {
  getLatestByField(
    workspaceId: string,
    fieldId: string,
  ): Promise<FieldCropContext | null>;
  upsertContext(
    input: UpsertFieldCropContextInput,
  ): Promise<FieldCropContext>;
};

const DEFAULT_SOURCE_KEY = "field-crop-context:stage-updater";

function roundTo(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function toObservedDay(iso: string) {
  return iso.slice(0, 10);
}

export type RefreshFieldCropStageUseCaseInput = {
  repository: RefreshFieldCropStageRepository;
  input: RefreshFieldCropStageInput;
};

export async function refreshFieldCropStage(
  input: RefreshFieldCropStageUseCaseInput,
): Promise<RefreshFieldCropStageResult | null> {
  const current = await input.repository.getLatestByField(
    input.input.workspaceId,
    input.input.fieldId,
  );

  if (!current) {
    return null;
  }

  const observedDay = toObservedDay(input.input.weatherSignalSet.observedAt);
  const alreadyApplied = current.lastGddObservedOn === observedDay;
  const appliedDailyGdd = alreadyApplied
    ? 0
    : roundTo(Math.max(0, input.input.weatherSignalSet.gdd24h ?? 0), 3);
  const accumulatedGdd = roundTo(current.accumulatedGdd + appliedDailyGdd, 3);
  const derivedGrowthStage = deriveGrowthStageFromAccumulatedGdd(
    accumulatedGdd,
    input.input.thresholds,
  );
  const growthStage =
    current.growthStageSource === "manual" && current.growthStage
      ? current.growthStage
      : derivedGrowthStage;
  const growthStageSource =
    current.growthStageSource === "manual" ? "manual" : "derived";

  const next = await input.repository.upsertContext({
    workspaceId: current.workspaceId,
    fieldId: current.fieldId,
    seasonYear: current.seasonYear,
    cropType: current.cropType,
    growthStage,
    growthStageSource,
    accumulatedGdd,
    lastGddObservedOn: observedDay,
    lastWeatherSignalSetId: input.input.weatherSignalSet.id,
    lastStageUpdatedAt: input.input.requestedAt,
    sourceKey: input.input.sourceKey ?? DEFAULT_SOURCE_KEY,
    metadata: {
      ...(typeof current.metadata === "object" && current.metadata !== null
        ? current.metadata
        : {}),
      lastDerivedGrowthStage: derivedGrowthStage,
      lastAppliedObservedDay: observedDay,
      lastAppliedDailyGdd: appliedDailyGdd,
    },
  });

  return {
    context: next,
    appliedDailyGdd,
    derivedGrowthStage,
    updated:
      appliedDailyGdd > 0 ||
      next.growthStage !== current.growthStage ||
      next.growthStageSource !== current.growthStageSource,
  };
}
