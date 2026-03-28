import type { FieldWeatherForecast } from "./FieldWeatherForecast";
import type { FieldWeatherObservation } from "./FieldWeatherObservation";

export type FieldWeatherProfile = {
  latestObservation: FieldWeatherObservation | null;
  forecasts: readonly FieldWeatherForecast[];
};
