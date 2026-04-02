import type {
  EntityId,
  TimestampIso,
  WorkspaceScoped,
} from "@fieldpulse/platform-db";
import type { WeatherProvider } from "./WeatherProvider";

export type FieldWeatherDerivedSignalSetProvenance = {
  calculationMode?: string;
  forecastSampleCount24h?: number;
  forecastSampleCount72h?: number;
  forecastSampleCount168h?: number;
  observationSampleCount72h?: number;
  observationSampleCount168h?: number;
  soilTempThresholdC?: number;
  frostProbabilityModelKey?: string;
  frostProbabilityThresholdC?: number;
  frostProbabilityMemberCount?: number;
  windowHours24?: number;
  windowHours72?: number;
  windowHours168?: number;
};

export type FieldWeatherDerivedSignalSet = WorkspaceScoped & {
  id: EntityId;
  fieldId: EntityId;
  weatherObservationId: EntityId | null;
  observedAt: TimestampIso;
  forecastRunAt: TimestampIso | null;
  sourceKey: string;
  providerKey: WeatherProvider;
  signalVersion: string;
  currentVpdKpa: number | null;
  peakForecastVpdKpa24h: number | null;
  netWaterBalance24hMm: number | null;
  netWaterBalance72hMm: number | null;
  leafWetHours24h: number;
  sprayWindowCount24h: number;
  frostRiskMinTempC: number | null;
  frostRiskMinTempC7d: number | null;
  frostRiskNights7d: number | null;
  frostProbabilityPct7d: number | null;
  recentPrecipTotal72hMm: number | null;
  freezeThawCycles7d: number | null;
  soilTemp6cmCurrentC: number | null;
  soilTemp6cmSustainedDays: number | null;
  gdd24h: number | null;
  gdd72h: number | null;
  gddBaseC: number;
  provenance: FieldWeatherDerivedSignalSetProvenance;
  createdAt: TimestampIso;
  updatedAt: TimestampIso;
};
