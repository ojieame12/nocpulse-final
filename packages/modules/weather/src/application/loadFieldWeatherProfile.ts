import type { EntityId, TimestampIso, WorkspaceId } from "@fieldpulse/platform-db";
import type { FieldWeatherForecast } from "../contracts/FieldWeatherForecast";
import type { FieldWeatherObservation } from "../contracts/FieldWeatherObservation";
import type { FieldWeatherProfile } from "../contracts/FieldWeatherProfile";

type LoadFieldWeatherProfileObservationRepository = {
  getLatestByField(
    workspaceId: WorkspaceId,
    fieldId: EntityId,
  ): Promise<FieldWeatherObservation | null>;
};

type LoadFieldWeatherProfileForecastRepository = {
  listByField(input: {
    workspaceId: WorkspaceId;
    fieldId: EntityId;
    validAfter?: TimestampIso;
    limit?: number;
  }): Promise<readonly FieldWeatherForecast[]>;
};

export type LoadFieldWeatherProfileInput = {
  observationRepository: LoadFieldWeatherProfileObservationRepository;
  forecastRepository: LoadFieldWeatherProfileForecastRepository;
  workspaceId: WorkspaceId;
  fieldId: EntityId;
  validAfter?: TimestampIso;
  forecastLimit?: number;
};

export async function loadFieldWeatherProfile(
  input: LoadFieldWeatherProfileInput,
): Promise<FieldWeatherProfile> {
  const [latestObservationResult, forecastsResult] = await Promise.allSettled([
    input.observationRepository.getLatestByField(
      input.workspaceId,
      input.fieldId,
    ),
    input.forecastRepository.listByField({
      workspaceId: input.workspaceId,
      fieldId: input.fieldId,
      validAfter: input.validAfter,
      limit: input.forecastLimit,
    }),
  ]);

  const latestObservation =
    latestObservationResult.status === "fulfilled" ? latestObservationResult.value : null;
  const forecasts =
    forecastsResult.status === "fulfilled"
      ? forecastsResult.value
      : ([] as readonly FieldWeatherForecast[]);

  if (latestObservationResult.status === "rejected") {
    console.warn(
      `[weather] latest observation lookup failed for ${input.workspaceId}/${input.fieldId}: ${
        latestObservationResult.reason instanceof Error
          ? latestObservationResult.reason.message
          : String(latestObservationResult.reason)
      }`,
    );
  }

  if (forecastsResult.status === "rejected") {
    console.warn(
      `[weather] forecast lookup failed for ${input.workspaceId}/${input.fieldId}: ${
        forecastsResult.reason instanceof Error
          ? forecastsResult.reason.message
          : String(forecastsResult.reason)
      }`,
    );
  }

  return {
    latestObservation,
    forecasts,
    dataAvailability: {
      latestObservation: latestObservationResult.status === "fulfilled",
      forecasts: forecastsResult.status === "fulfilled",
    },
  };
}
