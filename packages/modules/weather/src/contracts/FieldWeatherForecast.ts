import type {
  EntityId,
  TimestampIso,
  WorkspaceScoped,
} from "@fieldpulse/platform-db";
import type { WeatherProvider } from "./WeatherProvider";

export type FieldWeatherForecast = WorkspaceScoped & {
  id: EntityId;
  fieldId: EntityId;
  forecastRunAt: TimestampIso;
  validAt: TimestampIso;
  sourceKey: string;
  providerKey: WeatherProvider;
  airTemperatureMinC: number;
  airTemperatureMaxC: number;
  precipitationMm: number;
  windSpeedKph: number;
  relativeHumidityPct: number | null;
  evapotranspirationMm: number | null;
  precipitationProbabilityPct: number | null;
  createdAt: TimestampIso;
  updatedAt: TimestampIso;
};
