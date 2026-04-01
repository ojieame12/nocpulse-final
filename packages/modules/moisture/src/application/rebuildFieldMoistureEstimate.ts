import type { EntityId, WorkspaceId } from "@fieldpulse/platform-db";
import type { FieldMoistureSnapshot } from "../contracts/FieldMoistureSnapshot";
import type { MoistureInputProvenance } from "../contracts/FieldMoistureSnapshot";
import type { RebuildFieldMoistureEstimateInput } from "../contracts/RebuildFieldMoistureEstimateInput";
import type { RebuildFieldMoistureEstimateResult } from "../contracts/RebuildFieldMoistureEstimateResult";
import { computeKc } from "../domain/crop/computeKc";
import { resolveStageWeights } from "../domain/crop/resolveStageWeights";
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
  observedAt?: string | null;
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
  provenance?: {
    soilDataset?: string | null;
    forecastModel?: string | null;
  } | null;
};

type WeatherSignalSetLike = {
  netWaterBalance24hMm: number | null;
  netWaterBalance72hMm?: number | null;
};

export type RebuildFieldMoistureEstimateSources = {
  rasterObservation?: RasterObservationLike | null;
  weatherObservation?: WeatherObservationLike | null;
  weatherSignalSet?: WeatherSignalSetLike | null;
  /** Diagonal of the field bounding box in metres, used for scale-fit penalty. */
  fieldDiagonalM?: number | null;
  /** ISO timestamp of the current estimate, used to compute raster age. */
  estimateTimestamp?: string | null;
  /** Crop type key (e.g. "wheat", "corn"), used for FAO-56 Kc adjustment. */
  cropType?: string | null;
  /** Growth stage (e.g. "vegetative", "flowering"), used for Kc phase and satellite weights. */
  growthStage?: string | null;
};

export type RebuildFieldMoistureEstimateOptions = {
  /**
   * When true (default), the fake thermal term derived from SAR wetness
   * is dropped from the moisture formula. Set to false to restore the
   * legacy behavior for rollback purposes.
   */
  dropFakeThermal?: boolean;
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

function isSarRasterSource(sourceKey: string | null | undefined) {
  const normalized = sourceKey?.toLowerCase() ?? "";
  return normalized.includes("sentinel-1") || normalized.includes("sar");
}

function isOpticalRasterSource(sourceKey: string | null | undefined) {
  const normalized = sourceKey?.toLowerCase() ?? "";
  return normalized.includes("sentinel-2") || normalized.includes("planet");
}

// ---------------------------------------------------------------------------
// Freshness-weighted confidence helpers
// ---------------------------------------------------------------------------

const MAX_RASTER_AGE_HOURS = 360; // 15 days

export function computeRasterAgeHours(
  rasterObservedAt: string | null | undefined,
  estimateTimestamp: string | null | undefined,
): number | null {
  if (!rasterObservedAt) return null;
  const rasterTime = new Date(rasterObservedAt).getTime();
  if (Number.isNaN(rasterTime)) return null;
  const now = estimateTimestamp
    ? new Date(estimateTimestamp).getTime()
    : Date.now();
  if (Number.isNaN(now)) return null;
  return Math.max(0, (now - rasterTime) / (1000 * 60 * 60));
}

export function computeFreshnessFactor(ageHours: number | null): number {
  if (ageHours === null) return 1; // no age info -> assume fresh (backward compat)
  return Math.max(0, 1 - ageHours / MAX_RASTER_AGE_HOURS);
}

// ---------------------------------------------------------------------------
// Resolution tier
// ---------------------------------------------------------------------------

export type ResolutionTier = "sub-field" | "field-level" | "regional";

export function resolveResolutionTier(
  sourceKey: string | null | undefined,
  weatherSourceKey: string | null | undefined,
): { tier: ResolutionTier; resolutionM: number } {
  const rasterNorm = sourceKey?.toLowerCase() ?? "";
  if (
    rasterNorm.includes("sentinel-2") ||
    rasterNorm.includes("sentinel-1") ||
    rasterNorm.includes("planet")
  ) {
    return { tier: "sub-field", resolutionM: 15 };
  }
  if (rasterNorm.includes("soilgrids")) {
    return { tier: "field-level", resolutionM: 250 };
  }
  const weatherNorm = weatherSourceKey?.toLowerCase() ?? "";
  if (weatherNorm.includes("open-meteo") || weatherNorm.includes("era5")) {
    return { tier: "regional", resolutionM: 9000 };
  }
  if (rasterNorm.length > 0) {
    return { tier: "field-level", resolutionM: 250 };
  }
  return { tier: "regional", resolutionM: 9000 };
}

// ---------------------------------------------------------------------------
// Scale-fit penalty
// ---------------------------------------------------------------------------

export function computeScaleFitPenalty(
  fieldDiagonalM: number | null | undefined,
  sourceResolutionM: number,
): number {
  if (fieldDiagonalM == null || fieldDiagonalM <= 0) return 0;
  const ratio = fieldDiagonalM / sourceResolutionM;
  return ratio < 0.5 ? -0.05 : 0;
}

// ---------------------------------------------------------------------------
// Multi-source agreement
// ---------------------------------------------------------------------------

export type AgreementResult = {
  deltaPct: number;
  flag: "agree" | "neutral" | "divergent";
  bonus: number;
};

export function computeAgreement(
  rasterMoisturePct: number | null,
  weatherMoisturePct: number | null,
): AgreementResult | null {
  if (rasterMoisturePct === null || weatherMoisturePct === null) return null;
  const deltaPct = Math.abs(rasterMoisturePct - weatherMoisturePct);
  if (deltaPct < 5) return { deltaPct, flag: "agree", bonus: 0.10 };
  if (deltaPct <= 15) return { deltaPct, flag: "neutral", bonus: 0 };
  return { deltaPct, flag: "divergent", bonus: -0.05 };
}

// ---------------------------------------------------------------------------
// Convert a raster moisture signal (0-1 NDMI/SAR range) to approximate
// volumetric soil moisture % so it can be compared with weather soil moisture.
// ---------------------------------------------------------------------------

function rasterSignalToPct(signal: number | null): number | null {
  if (signal === null) return null;
  return 20 + signal * 40;
}

// ---------------------------------------------------------------------------
// Core derivation
// ---------------------------------------------------------------------------

function deriveSourceBackedEstimate(
  sources: RebuildFieldMoistureEstimateSources,
  options: RebuildFieldMoistureEstimateOptions = {},
) {
  const dropFakeThermal = options.dropFakeThermal !== false;
  const rasterObservation = sources.rasterObservation ?? null;
  const weatherObservation = sources.weatherObservation ?? null;
  const weatherSignalSet = sources.weatherSignalSet ?? null;
  const avgNdmi = averageMeasurement(rasterObservation, "ndmi");
  const avgNdvi = averageMeasurement(rasterObservation, "ndvi");
  const avgThermal = averageMeasurement(rasterObservation, "thermal");
  const avgShadow = averageMeasurement(rasterObservation, "shadow");
  const avgSarWetness = averageMeasurement(rasterObservation, "sarWetness");
  const avgSarRatio = averageMeasurement(rasterObservation, "sarRatio");

  // Stage-gated satellite signal blending
  const cropType = sources.cropType ?? null;
  const growthStage = sources.growthStage ?? null;
  const stageWeights = resolveStageWeights(growthStage);
  const moistureSignal =
    avgNdmi !== null && avgSarWetness !== null
      ? avgNdmi * stageWeights.ndmiWeight + avgSarWetness * stageWeights.sarWeight
      : avgNdmi ?? avgSarWetness;
  const vigorSignal =
    avgNdvi ??
    (avgSarRatio === null ? null : clamp(0.6 - (avgSarRatio - 0.5) * 0.18, 0, 1));
  const thermalSignal = dropFakeThermal
    ? null
    : avgThermal ??
      (avgSarWetness === null ? null : clamp(1 - avgSarWetness * 0.9, 0, 1));
  const shadowSignal = avgShadow ?? avgSarRatio;
  const weatherSoilMoisture = weatherObservation?.soilMoisturePct ?? null;
  const precipitationMm = weatherObservation?.precipitationMm ?? 0;
  const referenceEtMm = weatherObservation?.evapotranspirationMm ?? 0;
  // FAO-56 Kc adjustment: actualET = referenceET × Kc
  const kc = computeKc(cropType, growthStage);
  const evapotranspirationMm = referenceEtMm * kc;
  const relativeHumidityPct = weatherObservation?.relativeHumidityPct ?? null;
  const rasterSourceKey = rasterObservation?.sourceKey ?? null;
  const weatherSourceKey = weatherObservation?.sourceKey ?? null;
  const baselineDataset =
    weatherSoilMoisture !== null
      ? weatherObservation?.provenance?.soilDataset ?? weatherSourceKey
      : null;

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
  // Prefer real water balance from weather signal set; fall back to ad-hoc inline calc
  const moisturePulse =
    weatherSignalSet?.netWaterBalance24hMm ??
    (precipitationMm * 1.6 - evapotranspirationMm * 2.2);
  const humidityLift =
    relativeHumidityPct !== null ? (relativeHumidityPct - 50) * 0.08 : 0;

  // When dropFakeThermal is true (default), thermalSignal is null and contributes 0.
  const thermalRootContrib =
    thermalSignal !== null ? -((thermalSignal - 0.5) * 8) : 0;
  const thermalSurfaceContrib =
    thermalSignal !== null ? -((thermalSignal - 0.5) * 14) : 0;

  const rootZonePct = clamp(
    rootBase +
      ((moistureSignal ?? 0.5) - 0.5) * 38 +
      ((vigorSignal ?? 0.5) - 0.5) * 12 +
      thermalRootContrib +
      ((shadowSignal ?? 0.5) - 0.5) * 4 +
      moisturePulse +
      humidityLift,
    0,
    100,
  );

  const surfacePct = clamp(
    surfaceBase +
      ((moistureSignal ?? 0.5) - 0.5) * 32 +
      ((vigorSignal ?? 0.5) - 0.5) * 6 +
      thermalSurfaceContrib -
      ((shadowSignal ?? 0.5) - 0.5) * 3 +
      moisturePulse * 1.25 +
      humidityLift * 0.6,
    0,
    100,
  );

  // -----------------------------------------------------------------------
  // Confidence scoring — freshness-weighted with agreement & scale-fit
  // -----------------------------------------------------------------------

  let confidenceScore = 0;

  // 1. Freshness-weighted raster score (replaces fixed +0.45 / +0.25)
  const rasterAgeHours = computeRasterAgeHours(
    rasterObservation?.observedAt,
    sources.estimateTimestamp,
  );
  const freshnessFactor = computeFreshnessFactor(rasterAgeHours);

  if (hasRasterSignal) {
    const baseRasterScore = isSyntheticRasterSource(rasterObservation?.sourceKey)
      ? 0.25
      : 0.45;
    confidenceScore += baseRasterScore * freshnessFactor;
  }

  if (weatherSoilMoisture !== null) {
    confidenceScore += 0.35;
  } else if (hasWeatherSignal) {
    confidenceScore += 0.2;
  }

  if (precipitationMm > 0 || evapotranspirationMm > 0) {
    confidenceScore += 0.1;
  }

  // 2. Multi-source agreement bonus/penalty
  const rasterMoisturePct = rasterSignalToPct(moistureSignal);
  const agreement = computeAgreement(rasterMoisturePct, weatherSoilMoisture);
  if (agreement !== null) {
    confidenceScore += agreement.bonus;
  }

  // 3. Resolution tier & scale-fit penalty
  const { tier: resolutionTier, resolutionM } = resolveResolutionTier(
    rasterSourceKey,
    weatherSourceKey,
  );
  const scaleFitPenalty = computeScaleFitPenalty(
    sources.fieldDiagonalM,
    resolutionM,
  );
  confidenceScore += scaleFitPenalty;

  // Clamp final confidence score to 0..0.97
  confidenceScore = clamp(confidenceScore, 0, 0.97);

  const confidence =
    confidenceScore >= 0.75
      ? "high"
      : confidenceScore >= 0.45
        ? "medium"
        : "low";

  const rasterMode =
    rasterObservation == null
      ? "none"
      : isSyntheticRasterSource(rasterSourceKey)
        ? "synthetic"
        : "provider";
  const signalBlend =
    hasRasterSignal && hasWeatherSignal
      ? "raster+weather"
      : hasRasterSignal
        ? "raster-only"
        : "weather-only";
  const confidenceReasonParts: string[] = [];

  if (hasRasterSignal) {
    confidenceReasonParts.push(
      rasterMode === "provider" ? "provider raster signal" : "synthetic raster signal",
    );
  }

  if (weatherSoilMoisture !== null) {
    confidenceReasonParts.push(
      baselineDataset === null ? "weather soil moisture" : "baseline soil moisture",
    );
  } else if (hasWeatherSignal) {
    confidenceReasonParts.push("weather pulse");
  }

  if (precipitationMm > 0 || evapotranspirationMm > 0) {
    confidenceReasonParts.push("precipitation/evapotranspiration");
  }

  if (agreement?.flag === "agree") {
    confidenceReasonParts.push("signals-agree");
  } else if (agreement?.flag === "divergent") {
    confidenceReasonParts.push("signals-divergent");
  }

  if (scaleFitPenalty < 0) {
    confidenceReasonParts.push("scale-fit-penalty");
  }

  return {
    rootZonePct: Number(rootZonePct.toFixed(1)),
    surfacePct: Number(surfacePct.toFixed(1)),
    confidence,
    confidenceScore: Number(confidenceScore.toFixed(2)),
    provenance: {
      moistureModelVersion: "derived-moisture-v1",
      derivationMode: "source-backed",
      rasterSourceKey: rasterSourceKey ?? undefined,
      weatherSourceKey: weatherSourceKey ?? undefined,
      baselineDataset: baselineDataset ?? undefined,
      rasterMode,
      signalBlend,
      usedOptical: isOpticalRasterSource(rasterSourceKey),
      usedSar: isSarRasterSource(rasterSourceKey),
      usedWeather: hasWeatherSignal,
      usedWeatherSoilMoisture: weatherSoilMoisture !== null,
      confidenceReason:
        confidenceReasonParts.length > 0
          ? confidenceReasonParts.join(" + ")
          : "derived inputs unavailable",
      // New provenance fields
      rasterAgeHours:
        rasterAgeHours !== null ? Number(rasterAgeHours.toFixed(1)) : undefined,
      freshnessFactor:
        hasRasterSignal ? Number(freshnessFactor.toFixed(3)) : undefined,
      agreementDeltaPct:
        agreement !== null ? Number(agreement.deltaPct.toFixed(1)) : undefined,
      agreementFlag: agreement?.flag ?? undefined,
      resolutionTier,
      scaleFitPenalty: scaleFitPenalty < 0 ? scaleFitPenalty : undefined,
    } satisfies Partial<MoistureInputProvenance>,
  } as const;
}

export async function rebuildFieldMoistureEstimate(input: {
  repository: RebuildFieldMoistureEstimateRepository;
  estimate: RebuildFieldMoistureEstimateInput;
  sources?: RebuildFieldMoistureEstimateSources;
  options?: RebuildFieldMoistureEstimateOptions;
}): Promise<RebuildFieldMoistureEstimateResult> {
  const sourceBackedEstimate = deriveSourceBackedEstimate(
    input.sources ?? {},
    input.options,
  );
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
  const derivedInputs: MoistureInputProvenance = sourceBackedEstimate
    ? {
        ...input.estimate.inputs,
        ...sourceBackedEstimate.provenance,
        confidenceScore: sourceBackedEstimate.confidenceScore,
      }
    : {
        ...input.estimate.inputs,
        moistureModelVersion: "derived-moisture-v1",
        derivationMode: "seeded-range",
        rasterMode: "none",
        signalBlend: "seeded",
        usedOptical: false,
        usedSar: false,
        usedWeather: false,
        usedWeatherSoilMoisture: false,
        confidenceReason: "seeded fallback range",
      };

  return ensureFieldMoistureSnapshot({
    repository: input.repository,
    snapshot: {
      ...input.estimate,
      rootZonePct,
      surfacePct,
      confidence,
      inputs: derivedInputs,
    },
  });
}
