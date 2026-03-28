import type { FieldWeatherObservation } from "../contracts/FieldWeatherObservation";
import type { UpsertFieldWeatherObservationInput } from "../contracts/UpsertFieldWeatherObservationInput";

type UpsertFieldWeatherObservationRepository = {
  upsertObservation(
    input: UpsertFieldWeatherObservationInput,
  ): Promise<FieldWeatherObservation>;
};

export type UpsertFieldWeatherObservationUseCaseInput = {
  repository: UpsertFieldWeatherObservationRepository;
  observation: UpsertFieldWeatherObservationInput;
};

export async function upsertFieldWeatherObservation(
  input: UpsertFieldWeatherObservationUseCaseInput,
): Promise<FieldWeatherObservation> {
  return input.repository.upsertObservation(input.observation);
}
