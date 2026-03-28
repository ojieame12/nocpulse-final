import type { EntityId, TimestampIso, WorkspaceScoped } from "@fieldpulse/platform-db";
import type { FieldWeatherObservationProvenance } from "./FieldWeatherObservation";
import type { WeatherProvider } from "./WeatherProvider";

export type UpsertFieldWeatherObservationInput = WorkspaceScoped & {
  fieldId: EntityId;
  observedAt: TimestampIso;
  sourceKey: string;
  providerKey: WeatherProvider;
  airTemperatureC: number;
  precipitationMm: number;
  windSpeedKph: number;
  relativeHumidityPct?: number | null;
  soilMoisturePct?: number | null;
  evapotranspirationMm?: number | null;
  provenance?: FieldWeatherObservationProvenance;
};
