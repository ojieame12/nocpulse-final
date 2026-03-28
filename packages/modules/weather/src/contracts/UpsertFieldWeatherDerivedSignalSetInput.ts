import type { EntityId, TimestampIso, WorkspaceScoped } from "@fieldpulse/platform-db";
import type { WeatherProvider } from "./WeatherProvider";
import type { FieldWeatherDerivedSignalSetProvenance } from "./FieldWeatherDerivedSignalSet";

export type UpsertFieldWeatherDerivedSignalSetInput = WorkspaceScoped & {
  fieldId: EntityId;
  weatherObservationId?: EntityId | null;
  observedAt: TimestampIso;
  forecastRunAt?: TimestampIso | null;
  sourceKey: string;
  providerKey: WeatherProvider;
  signalVersion: string;
  currentVpdKpa?: number | null;
  peakForecastVpdKpa24h?: number | null;
  netWaterBalance24hMm?: number | null;
  netWaterBalance72hMm?: number | null;
  leafWetHours24h?: number;
  sprayWindowCount24h?: number;
  frostRiskMinTempC?: number | null;
  gdd24h?: number | null;
  gdd72h?: number | null;
  gddBaseC?: number;
  provenance?: FieldWeatherDerivedSignalSetProvenance;
};
