import type { EntityId, WorkspaceId } from "@fieldpulse/platform-db";
import type { FieldMoistureSnapshot } from "../contracts/FieldMoistureSnapshot";
import type { MoistureInputProvenance } from "../contracts/FieldMoistureSnapshot";
import type { MoistureConfidence } from "../contracts/MoistureEstimate";
import type { RebuildFieldMoistureEstimateInput } from "../contracts/RebuildFieldMoistureEstimateInput";
import type { RebuildFieldMoistureEstimateResult } from "../contracts/RebuildFieldMoistureEstimateResult";
import { resolveRootZoneMoisture } from "@fieldpulse/module-weather";
import { computeKc } from "../domain/crop/computeKc";
import { computeDrainageMm, inferTextureClass } from "../domain/drainage/computeDrainage";
import type { SoilTextureClass } from "../domain/drainage/computeDrainage";
import { resolveStageWeights } from "../domain/crop/resolveStageWeights";
import { resolveRootDepthCm } from "../domain/crop/resolveRootDepthCm";
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
  /**
   * Optional raw soil moisture layer values keyed by Open-Meteo field names
   * (e.g. "soil_moisture_3_to_9cm"). When provided, the depth translation
   * layer computes a depth-weighted root-zone average via `resolveRootZoneMoisture`
   * instead of using the pre-computed `soilMoisturePct`.
   */
  soilMoistureLayers?: Record<string, number | null> | null;
  /**
   * Which Open-Meteo depth schema the layer keys belong to.
   * Defaults to "forecast" when `soilMoistureLayers` is provided.
   */
  soilMoistureLayerSchema?: "forecast" | "archive" | null;
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
  /** Field capacity volumetric %, from SoilGrids (0-100). */
  fieldCapacityPct?: number | null;
  /** Wilting point volumetric %, from SoilGrids (0-100). */
  wiltingPointPct?: number | null;
  /** Root zone depth in cm, default 30. */
  rootZoneDepthCm?: number;
  /** Hours since the last observation, used for drainage decay timing. Defaults to 24 if not provided. */
  hoursSinceLastObservation?: number | null;
  /** Explicit soil texture class override; inferred from FC if not provided. */
  soilTextureClass?: SoilTextureClass | null;
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

export function shouldCapHighConfidence(input: {
  rasterAgeHours: number | null;
  agreementFlag: AgreementResult["flag"] | null | undefined;
}): boolean {
  const hasStaleRaster =
    input.rasterAgeHours !== null && input.rasterAgeHours > 48;
  const weakAgreement =
    input.agreementFlag === "neutral" || input.agreementFlag === "divergent";
  return hasStaleRaster && weakAgreement;
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
  // -----------------------------------------------------------------------
  // Depth-translated root-zone moisture: when raw layer values are available,
  // use resolveRootZoneMoisture for depth-weighted averaging instead of using
  // a single pre-computed value. This allows crop-stage-aware root-zone depths
  // to automatically adjust the weighting.
  // When only a pre-computed soilMoisturePct is available (no raw layers),
  // the depth translation does not apply.
  // -----------------------------------------------------------------------
  const rootZoneDepthCm = sources.rootZoneDepthCm ?? resolveRootDepthCm(cropType, growthStage);
  const rawLayers = weatherObservation?.soilMoistureLayers ?? null;
  const layerSchema = weatherObservation?.soilMoistureLayerSchema ?? "forecast";
  // resolveRootZoneMoisture returns volumetric fraction (0-1) matching the
  // raw Open-Meteo layer units. Convert to percentage to match soilMoisturePct.
  const depthTranslatedRaw =
    rawLayers !== null
      ? resolveRootZoneMoisture(rawLayers, layerSchema, rootZoneDepthCm)
      : null;
  const depthTranslatedMoisture =
    depthTranslatedRaw !== null
      ? Number((depthTranslatedRaw * 100).toFixed(1))
      : null;
  const usedDepthTranslation = depthTranslatedMoisture !== null;
  const weatherSoilMoisture =
    depthTranslatedMoisture ?? weatherObservation?.soilMoisturePct ?? null;
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

  let rootZonePct = clamp(
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

  let surfacePct = clamp(
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
  // Post-rain drainage decay — exponential decay of excess above FC
  // -----------------------------------------------------------------------

  const fcPct = sources.fieldCapacityPct ?? null;
  const wpPct = sources.wiltingPointPct ?? null;
  const textureClass =
    sources.soilTextureClass ?? inferTextureClass(fcPct, wpPct);
  const hoursSinceLastObs = sources.hoursSinceLastObservation ?? 24;

  if (fcPct !== null && rootZonePct > fcPct) {
    const drainedRoot = computeDrainageMm(rootZonePct, fcPct, hoursSinceLastObs, textureClass);
    rootZonePct = rootZonePct - drainedRoot;
  }

  if (fcPct !== null && surfacePct > fcPct) {
    const drainedSurface = computeDrainageMm(surfacePct, fcPct, hoursSinceLastObs, textureClass);
    surfacePct = surfacePct - drainedSurface;
  }

  // Floor at wilting point
  if (wpPct !== null) {
    rootZonePct = Math.max(rootZonePct, wpPct);
    surfacePct = Math.max(surfacePct, wpPct);
  }

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

  let confidence: MoistureConfidence =
    confidenceScore >= 0.75
      ? "high"
      : confidenceScore >= 0.45
        ? "medium"
        : "low";

  const cappedHighConfidence = shouldCapHighConfidence({
    rasterAgeHours,
    agreementFlag: agreement?.flag,
  });
  if (confidence === "high" && cappedHighConfidence) {
    confidence = "medium";
  }

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

  if (cappedHighConfidence) {
    confidenceReasonParts.push("confidence-capped-stale-neutral");
  }

  // -----------------------------------------------------------------------
  // Depletion computation (mm-based water storage)
  // -----------------------------------------------------------------------

  const fieldCapacityPct = sources.fieldCapacityPct ?? null;
  const wiltingPointPct = sources.wiltingPointPct ?? null;

  let depletionPct: number | null = null;
  let availableWaterMm: number | null = null;
  let waterStorageMm: number | null = null;

  const hasSoilProps =
    fieldCapacityPct != null &&
    wiltingPointPct != null &&
    fieldCapacityPct > wiltingPointPct;

  if (hasSoilProps && weatherSoilMoisture !== null) {
    const rootZoneDepthMm = rootZoneDepthCm * 10;
    const fcMm = (fieldCapacityPct / 100) * rootZoneDepthMm;
    const wpMm = (wiltingPointPct / 100) * rootZoneDepthMm;

    // Current storage from weather baseline (volumetric % -> mm)
    const baseStorageMm = (weatherSoilMoisture / 100) * rootZoneDepthMm;

    // Net water balance (already in mm)
    const netWaterBalanceMm = weatherSignalSet?.netWaterBalance24hMm ?? 0;
    const rawStorageMm = baseStorageMm + netWaterBalanceMm;

    // Drainage decay: excess above FC drains exponentially over time
    const depletionTextureClass =
      sources.soilTextureClass ?? inferTextureClass(fieldCapacityPct, wiltingPointPct);
    const hoursAge = sources.hoursSinceLastObservation ?? 24;
    const drainageMm = computeDrainageMm(rawStorageMm, fcMm, hoursAge, depletionTextureClass);

    let storageMm = rawStorageMm - drainageMm;
    // Clamp: floor at wilting point, ceiling at root-zone saturation.
    // Storage may remain above FC shortly after rain — drainage handles
    // the exponential decay back toward FC over time.
    storageMm = clamp(storageMm, wpMm, rootZoneDepthMm);

    waterStorageMm = Number(storageMm.toFixed(1));
    depletionPct = Number((((fcMm - storageMm) / (fcMm - wpMm)) * 100).toFixed(1));
    availableWaterMm = Number((storageMm - wpMm).toFixed(1));
  }

  return {
    rootZonePct: Number(rootZonePct.toFixed(1)),
    surfacePct: Number(surfacePct.toFixed(1)),
    confidence,
    confidenceScore: Number(confidenceScore.toFixed(2)),
    depletionPct,
    availableWaterMm,
    waterStorageMm,
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
      usedDepthTranslation,
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
      depletionPct,
      availableWaterMm,
      fieldCapacityPct: hasSoilProps ? fieldCapacityPct : undefined,
      wiltingPointPct: hasSoilProps ? wiltingPointPct : undefined,
      rootZoneDepthCm,
      waterStorageMm,
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
