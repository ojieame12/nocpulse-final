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

function extractSeedingDate(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const seedingDate = (value as { seedingDate?: unknown }).seedingDate;
  return typeof seedingDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(seedingDate)
    ? seedingDate
    : null;
}

function uniqueDailyGddHistory(input: {
  observedDay: string;
  latestSignal: { observedAt: string; gdd24h: number | null };
  recentSignals?: readonly { observedAt: string; gdd24h: number | null }[];
}) {
  const byDay = new Map<string, number>();
  const orderedSignals = [
    ...(input.recentSignals ?? []),
    input.latestSignal,
  ].sort((left, right) => left.observedAt.localeCompare(right.observedAt));

  for (const signal of orderedSignals) {
    const day = toObservedDay(signal.observedAt);

    if (day > input.observedDay) {
      continue;
    }

    byDay.set(day, roundTo(Math.max(0, signal.gdd24h ?? 0), 3));
  }

  return byDay;
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
  const seedingDate = extractSeedingDate(current.metadata);
  const signalHistory = uniqueDailyGddHistory({
    observedDay,
    latestSignal: input.input.weatherSignalSet,
    recentSignals: input.input.recentWeatherSignals,
  });
  const alreadyApplied = current.lastGddObservedOn === observedDay;
  const fallbackAppliedDailyGdd = alreadyApplied
    ? 0
    : roundTo(Math.max(0, input.input.weatherSignalSet.gdd24h ?? 0), 3);
  const appliedDailyGdd =
    seedingDate != null
      ? observedDay < seedingDate
        ? 0
        : signalHistory.get(observedDay) ?? 0
      : fallbackAppliedDailyGdd;
  const accumulatedGdd =
    seedingDate != null
      ? observedDay < seedingDate
        ? 0
        : roundTo(
            [...signalHistory.entries()]
              .filter(([day]) => day >= seedingDate)
              .reduce((sum, [, gdd24h]) => sum + gdd24h, 0),
            3,
          )
      : roundTo(current.accumulatedGdd + appliedDailyGdd, 3);
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
    lastGddObservedOn:
      seedingDate != null && observedDay < seedingDate ? null : observedDay,
    lastWeatherSignalSetId: input.input.weatherSignalSet.id,
    lastStageUpdatedAt: input.input.requestedAt,
    sourceKey: input.input.sourceKey ?? DEFAULT_SOURCE_KEY,
    metadata: {
      ...(typeof current.metadata === "object" && current.metadata !== null
        ? current.metadata
        : {}),
      lastDerivedGrowthStage: derivedGrowthStage,
      seasonAccumulationStartDate: seedingDate,
      lastAppliedObservedDay: observedDay,
      lastAppliedDailyGdd: appliedDailyGdd,
    },
  });

  return {
    context: next,
    appliedDailyGdd,
    derivedGrowthStage,
    updated:
      next.accumulatedGdd !== current.accumulatedGdd ||
      next.growthStage !== current.growthStage ||
      next.growthStageSource !== current.growthStageSource ||
      next.lastGddObservedOn !== current.lastGddObservedOn,
  };
}
