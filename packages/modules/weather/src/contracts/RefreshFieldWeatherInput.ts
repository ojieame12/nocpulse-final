import type { EntityId, TimestampIso, WorkspaceScoped } from "@fieldpulse/platform-db";
import type { FieldWeatherForecast } from "./FieldWeatherForecast";
import type { FieldWeatherDerivedSignalSet } from "./FieldWeatherDerivedSignalSet";
import type { FieldWeatherObservation } from "./FieldWeatherObservation";
import type { WeatherProvider } from "./WeatherProvider";

export type RefreshFieldWeatherInput = WorkspaceScoped & {
  fieldId: EntityId;
  latitude: number;
  longitude: number;
  requestedAt?: TimestampIso;
  forecastHours?: number;
  gddBaseC?: number;
};

export type RefreshFieldWeatherResult = {
  workspaceId: string;
  fieldId: string;
  providerKey: WeatherProvider;
  sourceKey: string;
  observation: FieldWeatherObservation;
  forecasts: readonly FieldWeatherForecast[];
  derivedSignals: FieldWeatherDerivedSignalSet;
};
