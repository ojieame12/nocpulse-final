import type { RasterFieldGridCell } from "@fieldpulse/raster";

type RasterObservationLike = {
  sourceKey: string;
  observedAt?: string | null;
  cells: readonly RasterFieldGridCell[];
};

type WeatherObservationLike = {
  sourceKey: string;
  precipitationMm: number;
  relativeHumidityPct: number | null;
  soilMoisturePct: number | null;
  evapotranspirationMm: number | null;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
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

export function deriveRasterCellMoisture(
  cell: RasterFieldGridCell,
  base: {
    rootZonePct: number;
    surfacePct: number;
  },
) {
  const sarWetness = cell.measurements.sarWetness ?? null;
  const sarRatio = cell.measurements.sarRatio ?? null;
  const ndmi = cell.measurements.ndmi ?? sarWetness ?? 0.5;
  const ndvi =
    cell.measurements.ndvi ??
    (sarRatio === null ? 0.5 : clamp(0.6 - (sarRatio - 0.5) * 0.18, 0, 1));
  const thermal =
    cell.measurements.thermal ??
    (sarWetness === null ? 0.5 : clamp(1 - sarWetness * 0.9, 0, 1));
  const shadow = cell.measurements.shadow ?? sarRatio ?? 0.5;

  const rootZonePct = clamp(
    base.rootZonePct +
      (ndmi - 0.5) * 38 +
      (ndvi - 0.5) * 12 -
      (thermal - 0.5) * 8 +
      (shadow - 0.5) * 4,
    0,
    100,
  );
  const surfacePct = clamp(
    base.surfacePct +
      (ndmi - 0.5) * 32 +
      (ndvi - 0.5) * 6 -
      (thermal - 0.5) * 14 -
      (shadow - 0.5) * 3,
    0,
    100,
  );

  return {
    rootZonePct: Number(rootZonePct.toFixed(2)),
    surfacePct: Number(surfacePct.toFixed(2)),
  };
}

export function deriveSourceBackedMoistureEstimate(sources: {
  rasterObservation?: RasterObservationLike | null;
  weatherObservation?: WeatherObservationLike | null;
}) {
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
