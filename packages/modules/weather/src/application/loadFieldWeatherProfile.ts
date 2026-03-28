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
  const [latestObservation, forecasts] = await Promise.all([
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

  return {
    latestObservation,
    forecasts,
  };
}
