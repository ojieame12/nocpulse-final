import type {
  EntityId,
  TimestampIso,
  WorkspaceScoped,
} from "@fieldpulse/platform-db";
import type { MoistureEstimate } from "./MoistureEstimate";

export type MoistureInputProvenance = {
  forecastModel?: string;
  radarDataset?: string;
  sarDataset?: string;
  soilDataset?: string;
  baselineDataset?: string;
  rasterSourceKey?: string;
  weatherSourceKey?: string;
  moistureModelVersion?: string;
  derivationMode?: "source-backed" | "seeded-range";
  rasterMode?: "provider" | "synthetic" | "none";
  signalBlend?: "raster+weather" | "raster-only" | "weather-only" | "seeded";
  usedOptical?: boolean;
  usedSar?: boolean;
  usedWeather?: boolean;
  usedWeatherSoilMoisture?: boolean;
  usedDepthTranslation?: boolean;
  confidenceScore?: number;
  confidenceReason?: string;
  rasterAgeHours?: number;
  freshnessFactor?: number;
  agreementDeltaPct?: number;
  agreementFlag?: "agree" | "neutral" | "divergent";
  resolutionTier?: "sub-field" | "field-level" | "regional";
  scaleFitPenalty?: number;
  depletionPct?: number | null;
  availableWaterMm?: number | null;
  fieldCapacityPct?: number | null;
  wiltingPointPct?: number | null;
  rootZoneDepthCm?: number;
  waterStorageMm?: number | null;
};

export type FieldMoistureSnapshot = WorkspaceScoped &
  MoistureEstimate & {
    id: EntityId;
    fieldId: EntityId;
    observedAt: TimestampIso;
    sourceKey: string;
    inputs: MoistureInputProvenance;
    createdAt: TimestampIso;
  };
