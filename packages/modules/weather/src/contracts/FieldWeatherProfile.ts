import type { FieldWeatherForecast } from "./FieldWeatherForecast";
import type { FieldWeatherObservation } from "./FieldWeatherObservation";

export type FieldWeatherProfileDataAvailability = {
  latestObservation: boolean;
  forecasts: boolean;
};

export type FieldWeatherProfile = {
  latestObservation: FieldWeatherObservation | null;
  forecasts: readonly FieldWeatherForecast[];
  dataAvailability: FieldWeatherProfileDataAvailability;
};
