import type { FieldWeatherDerivedSignalSet } from "../contracts/FieldWeatherDerivedSignalSet";
import type { ComputeFieldWeatherDerivedSignalsInput } from "../contracts/ComputeFieldWeatherDerivedSignalsInput";
import { deriveWeatherSignalSet } from "./deriveWeatherSignalSet";

type LoadLatestFieldWeatherObservationRepository = {
  getLatestByField(
    workspaceId: string,
    fieldId: string,
  ): Promise<import("../contracts/FieldWeatherObservation").FieldWeatherObservation | null>;
  listRecentByField(
    workspaceId: string,
    fieldId: string,
    limit?: number,
  ): Promise<readonly import("../contracts/FieldWeatherObservation").FieldWeatherObservation[]>;
};

type ListFieldWeatherForecastRepository = {
  listByField(input: {
    workspaceId: string;
    fieldId: string;
    validAfter?: string;
    limit?: number;
  }): Promise<readonly import("../contracts/FieldWeatherForecast").FieldWeatherForecast[]>;
};

type UpsertFieldWeatherDerivedSignalSetRepository = {
  getLatestByField(
    workspaceId: string,
    fieldId: string,
  ): Promise<FieldWeatherDerivedSignalSet | null>;
  upsertSignalSet(
    input: ReturnType<typeof deriveWeatherSignalSet>,
  ): Promise<FieldWeatherDerivedSignalSet>;
};

export type ComputeFieldWeatherDerivedSignalsUseCaseInput = {
  observations: LoadLatestFieldWeatherObservationRepository;
  forecasts: ListFieldWeatherForecastRepository;
  signalSets: UpsertFieldWeatherDerivedSignalSetRepository;
  input: ComputeFieldWeatherDerivedSignalsInput;
};

export async function computeFieldWeatherDerivedSignals(
  input: ComputeFieldWeatherDerivedSignalsUseCaseInput,
): Promise<FieldWeatherDerivedSignalSet | null> {
  const observation = await input.observations.getLatestByField(
    input.input.workspaceId,
    input.input.fieldId,
  );

  if (!observation) {
    return null;
  }

  const recentObservations = await input.observations.listRecentByField(
    input.input.workspaceId,
    input.input.fieldId,
    168,
  );
  const forecasts = await input.forecasts.listByField({
    workspaceId: input.input.workspaceId,
    fieldId: input.input.fieldId,
    validAfter: observation.observedAt,
    limit: input.input.forecastLimit ?? 168,
  });
  const previousSignalSet = await input.signalSets.getLatestByField(
    input.input.workspaceId,
    input.input.fieldId,
  );

  return input.signalSets.upsertSignalSet(
    deriveWeatherSignalSet({
      workspaceId: input.input.workspaceId,
      fieldId: input.input.fieldId,
      observation,
      recentObservations,
      forecasts,
      signalVersion: input.input.signalVersion,
      gddBaseC: input.input.gddBaseC,
      soilTempThresholdC: input.input.soilTempThresholdC,
      frostProbabilityPct7d:
        previousSignalSet?.observedAt === observation.observedAt
          ? previousSignalSet.frostProbabilityPct7d
          : null,
      frostProbabilityThresholdC:
        previousSignalSet?.observedAt === observation.observedAt
          ? previousSignalSet.provenance?.frostProbabilityThresholdC ?? null
          : null,
      frostProbabilityModelKey:
        previousSignalSet?.observedAt === observation.observedAt
          ? previousSignalSet.provenance?.frostProbabilityModelKey ?? null
          : null,
      frostProbabilityMemberCount:
        previousSignalSet?.observedAt === observation.observedAt
          ? previousSignalSet.provenance?.frostProbabilityMemberCount ?? null
          : null,
    }),
  );
}
