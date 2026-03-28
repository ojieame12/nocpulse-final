import type {
  EntityId,
  TimestampIso,
  WorkspaceScoped,
} from "@fieldpulse/platform-db";
import type { WeatherProvider } from "./WeatherProvider";

export type FieldWeatherObservationProvenance = {
  forecastModel?: string;
  radarDataset?: string;
  soilDataset?: string;
  stationId?: string;
};

export type FieldWeatherObservation = WorkspaceScoped & {
  id: EntityId;
  fieldId: EntityId;
  observedAt: TimestampIso;
  sourceKey: string;
  providerKey: WeatherProvider;
  airTemperatureC: number;
  precipitationMm: number;
  windSpeedKph: number;
  relativeHumidityPct: number | null;
  soilMoisturePct: number | null;
  evapotranspirationMm: number | null;
  provenance: FieldWeatherObservationProvenance;
  createdAt: TimestampIso;
  updatedAt: TimestampIso;
};
