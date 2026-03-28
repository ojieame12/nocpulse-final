import type { EntityId, WorkspaceId } from "@fieldpulse/platform-db";
import type { FieldMoistureSnapshot } from "../contracts/FieldMoistureSnapshot";
import type { RebuildFieldMoistureEstimateInput } from "../contracts/RebuildFieldMoistureEstimateInput";
import type { RebuildFieldMoistureEstimateResult } from "../contracts/RebuildFieldMoistureEstimateResult";
import { ensureFieldMoistureSnapshot } from "./ensureFieldMoistureSnapshot";

type RebuildFieldMoistureEstimateRepository = {
  getLatestByField(
    workspaceId: WorkspaceId,
    fieldId: EntityId,
  ): Promise<FieldMoistureSnapshot | null>;
  upsertSnapshot(input: {
    workspaceId: WorkspaceId;
    fieldId: EntityId;
    observedAt: string;
    sourceKey: string;
    rootZonePct: number;
    surfacePct: number;
    confidence: "low" | "medium" | "high";
    inputs: RebuildFieldMoistureEstimateInput["inputs"];
  }): Promise<FieldMoistureSnapshot>;
};

type RasterObservationLike = {
  sourceKey: string;
  cells: readonly {
    measurements: Readonly<Record<string, number>>;
  }[];
};

type WeatherObservationLike = {
  sourceKey: string;
  airTemperatureC: number;
  precipitationMm: number;
  relativeHumidityPct: number | null;
  soilMoisturePct: number | null;
  evapotranspirationMm: number | null;
};

export type RebuildFieldMoistureEstimateSources = {
  rasterObservation?: RasterObservationLike | null;
  weatherObservation?: WeatherObservationLike | null;
};

function hashSeed(workspaceId: WorkspaceId, fieldId: EntityId) {
  const value = `${workspaceId}:${fieldId}`;
  let hash = 0;

  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) % 10000;
  }

  return hash;
}

function normalizeToRange(seed: number, min: number, max: number) {
  const ratio = (seed % 1000) / 999;
  return Number((min + (max - min) * ratio).toFixed(1));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function average(values: readonly number[]) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function averageMeasurement(
  observation: RasterObservationLike | null | undefined,
  key: string,
) {
  if (!observation) {
    return null;
  }

  const values = observation.cells
    .map((cell) => cell.measurements[key])
    .filter((value): value is number => Number.isFinite(value));

  return average(values);
}

function isSyntheticRasterSource(sourceKey: string | null | undefined) {
  const normalized = sourceKey?.toLowerCase() ?? "";

  return (
    normalized.includes("synthetic") ||
    normalized.includes("fallback") ||
    normalized.includes("bootstrap")
  );
}

function deriveSourceBackedEstimate(
  sources: RebuildFieldMoistureEstimateSources,
) {
  const rasterObservation = sources.rasterObservation ?? null;
  const weatherObservation = sources.weatherObservation ?? null;
  const avgNdmi = averageMeasurement(rasterObservation, "ndmi");
  const avgNdvi = averageMeasurement(rasterObservation, "ndvi");
  const avgThermal = averageMeasurement(rasterObservation, "thermal");
  const avgShadow = averageMeasurement(rasterObservation, "shadow");
  const avgSarWetness = averageMeasurement(rasterObservation, "sarWetness");
  const avgSarRatio = averageMeasurement(rasterObservation, "sarRatio");
  const moistureSignal = avgNdmi ?? avgSarWetness;
  const vigorSignal =
    avgNdvi ??
    (avgSarRatio === null ? null : clamp(0.6 - (avgSarRatio - 0.5) * 0.18, 0, 1));
  const thermalSignal =
    avgThermal ??
    (avgSarWetness === null ? null : clamp(1 - avgSarWetness * 0.9, 0, 1));
  const shadowSignal = avgShadow ?? avgSarRatio;
  const weatherSoilMoisture = weatherObservation?.soilMoisturePct ?? null;
  const precipitationMm = weatherObservation?.precipitationMm ?? 0;
  const evapotranspirationMm = weatherObservation?.evapotranspirationMm ?? 0;
  const relativeHumidityPct = weatherObservation?.relativeHumidityPct ?? null;

  const hasRasterSignal =
    moistureSignal !== null ||
    vigorSignal !== null ||
    thermalSignal !== null ||
    shadowSignal !== null;
  const hasWeatherSignal =
    weatherSoilMoisture !== null ||
    precipitationMm > 0 ||
    evapotranspirationMm > 0 ||
    relativeHumidityPct !== null;

  if (!hasRasterSignal && !hasWeatherSignal) {
    return null;
  }

  const rootBase = weatherSoilMoisture ?? 42;
  const surfaceBase =
    weatherSoilMoisture !== null
      ? clamp(weatherSoilMoisture - 4, 0, 100)
      : 28;
  const moisturePulse = precipitationMm * 1.6 - evapotranspirationMm * 2.2;
  const humidityLift =
    relativeHumidityPct !== null ? (relativeHumidityPct - 50) * 0.08 : 0;

  const rootZonePct = clamp(
    rootBase +
      ((moistureSignal ?? 0.5) - 0.5) * 38 +
      ((vigorSignal ?? 0.5) - 0.5) * 12 -
      ((thermalSignal ?? 0.5) - 0.5) * 8 +
      ((shadowSignal ?? 0.5) - 0.5) * 4 +
      moisturePulse +
      humidityLift,
    0,
    100,
  );

  const surfacePct = clamp(
    surfaceBase +
      ((moistureSignal ?? 0.5) - 0.5) * 32 +
      ((vigorSignal ?? 0.5) - 0.5) * 6 -
      ((thermalSignal ?? 0.5) - 0.5) * 14 -
      ((shadowSignal ?? 0.5) - 0.5) * 3 +
      moisturePulse * 1.25 +
      humidityLift * 0.6,
    0,
    100,
  );

  let confidenceScore = 0;

  if (hasRasterSignal) {
    confidenceScore += isSyntheticRasterSource(rasterObservation?.sourceKey)
      ? 0.25
      : 0.45;
  }

  if (weatherSoilMoisture !== null) {
    confidenceScore += 0.35;
  } else if (hasWeatherSignal) {
    confidenceScore += 0.2;
  }

  if (precipitationMm > 0 || evapotranspirationMm > 0) {
    confidenceScore += 0.1;
  }

  const confidence =
    confidenceScore >= 0.75
      ? "high"
      : confidenceScore >= 0.45
        ? "medium"
        : "low";

  return {
    rootZonePct: Number(rootZonePct.toFixed(1)),
    surfacePct: Number(surfacePct.toFixed(1)),
    confidence,
  } as const;
}

export async function rebuildFieldMoistureEstimate(input: {
  repository: RebuildFieldMoistureEstimateRepository;
  estimate: RebuildFieldMoistureEstimateInput;
  sources?: RebuildFieldMoistureEstimateSources;
}): Promise<RebuildFieldMoistureEstimateResult> {
  const sourceBackedEstimate = deriveSourceBackedEstimate(input.sources ?? {});
  const seed = hashSeed(input.estimate.workspaceId, input.estimate.fieldId);
  const rootZonePct =
    sourceBackedEstimate?.rootZonePct ?? normalizeToRange(seed, 32, 68);
  const surfacePct =
    sourceBackedEstimate?.surfacePct ??
    Number(
      Math.max(8, rootZonePct - normalizeToRange(seed * 7, 4, 14)).toFixed(1),
    );

  const confidence =
    sourceBackedEstimate?.confidence ??
    (rootZonePct >= 55 ? "high" : rootZonePct >= 40 ? "medium" : "low");

  return ensureFieldMoistureSnapshot({
    repository: input.repository,
    snapshot: {
      ...input.estimate,
      rootZonePct,
      surfacePct,
      confidence,
    },
  });
}
