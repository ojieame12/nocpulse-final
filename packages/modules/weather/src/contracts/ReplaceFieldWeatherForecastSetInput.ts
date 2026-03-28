import type { EntityId, TimestampIso, WorkspaceScoped } from "@fieldpulse/platform-db";
import type { WeatherProvider } from "./WeatherProvider";

export type FieldWeatherForecastEntryInput = {
  validAt: TimestampIso;
  airTemperatureMinC: number;
  airTemperatureMaxC: number;
  precipitationMm: number;
  windSpeedKph: number;
  relativeHumidityPct?: number | null;
  evapotranspirationMm?: number | null;
  precipitationProbabilityPct?: number | null;
};

export type ReplaceFieldWeatherForecastSetInput = WorkspaceScoped & {
  fieldId: EntityId;
  forecastRunAt: TimestampIso;
  sourceKey: string;
  providerKey: WeatherProvider;
  entries: readonly FieldWeatherForecastEntryInput[];
};
