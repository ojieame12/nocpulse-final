import type { TimestampIso } from "@fieldpulse/platform-db";
import type {
  FieldWeatherObservationProvenance,
} from "./FieldWeatherObservation";
import type {
  FieldWeatherForecastEntryInput,
} from "./ReplaceFieldWeatherForecastSetInput";
import type { WeatherProvider } from "./WeatherProvider";

export type FetchFieldWeatherInput = {
  latitude: number;
  longitude: number;
  requestedAt?: TimestampIso;
  forecastHours?: number;
};

export type WeatherProviderObservation = {
  observedAt: TimestampIso;
  airTemperatureC: number;
  precipitationMm: number;
  windSpeedKph: number;
  relativeHumidityPct?: number | null;
  soilMoisturePct?: number | null;
  soilTemperature6cmC?: number | null;
  evapotranspirationMm?: number | null;
  provenance?: FieldWeatherObservationProvenance;
};

export type WeatherProviderForecastSet = {
  forecastRunAt: TimestampIso;
  entries: readonly FieldWeatherForecastEntryInput[];
};

export type FetchFieldWeatherResult = {
  providerKey: WeatherProvider;
  sourceKey: string;
  observation: WeatherProviderObservation;
  forecastSet: WeatherProviderForecastSet;
};

export type WeatherProviderClient = {
  providerKey: WeatherProvider;
  fetchFieldWeather(
    input: FetchFieldWeatherInput,
  ): Promise<FetchFieldWeatherResult>;
};
