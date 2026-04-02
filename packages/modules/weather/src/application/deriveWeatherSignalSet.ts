import type { UpsertFieldWeatherDerivedSignalSetInput } from "../contracts/UpsertFieldWeatherDerivedSignalSetInput";
import type { FieldWeatherForecast } from "../contracts/FieldWeatherForecast";
import type { FieldWeatherObservation } from "../contracts/FieldWeatherObservation";

const DEFAULT_SIGNAL_VERSION = "weather-derived-signals-v1";
const DEFAULT_GDD_BASE_C = 5;
const DEFAULT_SOIL_TEMP_THRESHOLD_C = 5;
const DEFAULT_FROST_WATCH_THRESHOLD_C = 2;

function roundTo(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function clampMinimum(value: number, minimum = 0) {
  return value < minimum ? minimum : value;
}

function calculateVpdKpa(
  temperatureC: number,
  relativeHumidityPct: number | null,
): number | null {
  if (relativeHumidityPct == null) {
    return null;
  }

  const saturation =
    0.6108 * Math.exp((17.27 * temperatureC) / (temperatureC + 237.3));
  const actual = saturation * (relativeHumidityPct / 100);

  return roundTo(clampMinimum(saturation - actual), 3);
}

function selectWindow(
  forecasts: readonly FieldWeatherForecast[],
  hours: number,
) {
  return forecasts.slice(0, Math.max(0, hours));
}

function sortObservationsAscending(
  observations: readonly FieldWeatherObservation[],
) {
  return [...observations].sort((left, right) =>
    left.observedAt.localeCompare(right.observedAt),
  );
}

function dedupeObservationTimeline(
  latestObservation: FieldWeatherObservation,
  recentObservations: readonly FieldWeatherObservation[],
) {
  const timeline = new Map<string, FieldWeatherObservation>();

  for (const observation of [...recentObservations, latestObservation]) {
    timeline.set(observation.observedAt, observation);
  }

  return sortObservationsAscending(Array.from(timeline.values()));
}

function selectObservationWindow(
  observations: readonly FieldWeatherObservation[],
  latestObservedAt: string,
  hours: number,
) {
  const latestMs = Date.parse(latestObservedAt);
  const earliestMs = latestMs - hours * 60 * 60 * 1000;

  return observations.filter((observation) => {
    const observedMs = Date.parse(observation.observedAt);
    return Number.isFinite(observedMs) && observedMs >= earliestMs && observedMs <= latestMs;
  });
}

function calculateMinimumForecastTemperature(
  forecasts: readonly FieldWeatherForecast[],
) {
  if (forecasts.length === 0) {
    return null;
  }

  return roundTo(
    Math.min(...forecasts.map((forecast) => forecast.airTemperatureMinC)),
    2,
  );
}

function calculateFrostRiskNights(
  forecasts: readonly FieldWeatherForecast[],
  thresholdC: number,
) {
  if (forecasts.length === 0) {
    return null;
  }

  const dailyMinimumByDate = new Map<string, number>();

  for (const forecast of forecasts) {
    const dateKey = forecast.validAt.slice(0, 10);
    const currentMinimum = dailyMinimumByDate.get(dateKey);
    const nextMinimum =
      currentMinimum == null
        ? forecast.airTemperatureMinC
        : Math.min(currentMinimum, forecast.airTemperatureMinC);

    dailyMinimumByDate.set(dateKey, nextMinimum);
  }

  return Array.from(dailyMinimumByDate.values()).reduce((count, minimum) => {
    return minimum <= thresholdC ? count + 1 : count;
  }, 0);
}

function sumNullable(values: readonly (number | null | undefined)[]) {
  const defined = values.filter((value): value is number => typeof value === "number");

  if (defined.length === 0) {
    return null;
  }

  return roundTo(defined.reduce((sum, value) => sum + value, 0), 2);
}

function calculateNetWaterBalanceMm(
  forecasts: readonly FieldWeatherForecast[],
) {
  const precipitation = sumNullable(forecasts.map((forecast) => forecast.precipitationMm));
  const evapotranspiration = sumNullable(
    forecasts.map((forecast) => forecast.evapotranspirationMm),
  );

  if (precipitation == null && evapotranspiration == null) {
    return null;
  }

  return roundTo((precipitation ?? 0) - (evapotranspiration ?? 0), 2);
}

function calculateLeafWetHours(
  forecasts: readonly FieldWeatherForecast[],
) {
  return forecasts.reduce((count, forecast) => {
    const averageTemperature =
      (forecast.airTemperatureMinC + forecast.airTemperatureMaxC) / 2;
    const humid = (forecast.relativeHumidityPct ?? 0) >= 90;
    const wetCanopyTemperature = averageTemperature >= 5 && averageTemperature <= 25;
    const precipitationSupport = forecast.precipitationMm >= 0.1;

    return humid && wetCanopyTemperature && precipitationSupport ? count + 1 : count;
  }, 0);
}

function calculateSprayWindowCount(
  forecasts: readonly FieldWeatherForecast[],
) {
  const eligible = forecasts.map((forecast) => {
    const averageTemperature =
      (forecast.airTemperatureMinC + forecast.airTemperatureMaxC) / 2;

    return (
      forecast.windSpeedKph <= 18 &&
      (forecast.precipitationProbabilityPct ?? 0) < 20 &&
      forecast.precipitationMm < 1 &&
      averageTemperature >= 10 &&
      averageTemperature <= 30
    );
  });

  let count = 0;

  for (let index = 0; index <= eligible.length - 4; index += 1) {
    if (
      eligible[index] &&
      eligible[index + 1] &&
      eligible[index + 2] &&
      eligible[index + 3]
    ) {
      count += 1;
    }
  }

  return count;
}

function calculateGdd(
  forecasts: readonly FieldWeatherForecast[],
  baseC: number,
) {
  if (forecasts.length === 0) {
    return null;
  }

  const total = forecasts.reduce((sum, forecast) => {
    const averageTemperature =
      (forecast.airTemperatureMinC + forecast.airTemperatureMaxC) / 2;
    return sum + clampMinimum(averageTemperature - baseC);
  }, 0);

  return roundTo(total / 24, 3);
}

function calculatePeakForecastVpd(
  forecasts: readonly FieldWeatherForecast[],
) {
  const values = forecasts
    .map((forecast) =>
      calculateVpdKpa(
        (forecast.airTemperatureMinC + forecast.airTemperatureMaxC) / 2,
        forecast.relativeHumidityPct,
      ),
    )
    .filter((value): value is number => value != null);

  if (values.length === 0) {
    return null;
  }

  return roundTo(Math.max(...values), 3);
}

function calculateRecentPrecipTotalMm(
  observations: readonly FieldWeatherObservation[],
) {
  if (observations.length === 0) {
    return null;
  }

  return roundTo(
    observations.reduce((sum, observation) => sum + observation.precipitationMm, 0),
    2,
  );
}

function calculateFreezeThawCycles(
  observations: readonly FieldWeatherObservation[],
) {
  if (observations.length < 2) {
    return null;
  }

  let cycles = 0;

  for (let index = 1; index < observations.length; index += 1) {
    const previous = observations[index - 1]?.airTemperatureC;
    const current = observations[index]?.airTemperatureC;

    if (
      (previous < 0 && current >= 0) ||
      (previous >= 0 && current < 0)
    ) {
      cycles += 1;
    }
  }

  return cycles;
}

function calculateSoilTempSustainedDays(
  observations: readonly FieldWeatherObservation[],
  thresholdC: number,
) {
  const minimaByDate = new Map<string, number>();

  for (const observation of observations) {
    if (observation.soilTemperature6cmC == null) {
      continue;
    }

    const dateKey = observation.observedAt.slice(0, 10);
    const currentMinimum = minimaByDate.get(dateKey);
    minimaByDate.set(
      dateKey,
      currentMinimum == null
        ? observation.soilTemperature6cmC
        : Math.min(currentMinimum, observation.soilTemperature6cmC),
    );
  }

  const dates = Array.from(minimaByDate.entries()).sort(([left], [right]) =>
    right.localeCompare(left),
  );

  if (dates.length === 0) {
    return null;
  }

  let sustainedDays = 0;

  for (const [, minimumSoilTemp] of dates) {
    if (minimumSoilTemp < thresholdC) {
      break;
    }

    sustainedDays += 1;
  }

  return sustainedDays;
}

export function deriveWeatherSignalSet(input: {
  workspaceId: string;
  fieldId: string;
  observation: FieldWeatherObservation;
  recentObservations?: readonly FieldWeatherObservation[];
  forecasts: readonly FieldWeatherForecast[];
  signalVersion?: string;
  gddBaseC?: number;
  soilTempThresholdC?: number;
}): UpsertFieldWeatherDerivedSignalSetInput {
  const next24h = selectWindow(input.forecasts, 24);
  const next72h = selectWindow(input.forecasts, 72);
  const next168h = selectWindow(input.forecasts, 168);
  const gddBaseC = input.gddBaseC ?? DEFAULT_GDD_BASE_C;
  const soilTempThresholdC =
    input.soilTempThresholdC ?? DEFAULT_SOIL_TEMP_THRESHOLD_C;
  const observationTimeline = dedupeObservationTimeline(
    input.observation,
    input.recentObservations ?? [],
  );
  const recentObservations72h = selectObservationWindow(
    observationTimeline,
    input.observation.observedAt,
    72,
  );
  const recentObservations168h = selectObservationWindow(
    observationTimeline,
    input.observation.observedAt,
    168,
  );

  return {
    workspaceId: input.workspaceId,
    fieldId: input.fieldId,
    weatherObservationId: input.observation.id,
    observedAt: input.observation.observedAt,
    forecastRunAt: input.forecasts[0]?.forecastRunAt ?? null,
    sourceKey: `${input.observation.sourceKey}:derived-signals`,
    providerKey: input.observation.providerKey,
    signalVersion: input.signalVersion ?? DEFAULT_SIGNAL_VERSION,
    currentVpdKpa: calculateVpdKpa(
      input.observation.airTemperatureC,
      input.observation.relativeHumidityPct,
    ),
    peakForecastVpdKpa24h: calculatePeakForecastVpd(next24h),
    netWaterBalance24hMm: calculateNetWaterBalanceMm(next24h),
    netWaterBalance72hMm: calculateNetWaterBalanceMm(next72h),
    leafWetHours24h: calculateLeafWetHours(next24h),
    sprayWindowCount24h: calculateSprayWindowCount(next24h),
    frostRiskMinTempC: calculateMinimumForecastTemperature(next24h),
    frostRiskMinTempC7d: calculateMinimumForecastTemperature(next168h),
    frostRiskNights7d: calculateFrostRiskNights(
      next168h,
      DEFAULT_FROST_WATCH_THRESHOLD_C,
    ),
    recentPrecipTotal72hMm: calculateRecentPrecipTotalMm(recentObservations72h),
    freezeThawCycles7d: calculateFreezeThawCycles(recentObservations168h),
    soilTemp6cmCurrentC: input.observation.soilTemperature6cmC ?? null,
    soilTemp6cmSustainedDays: calculateSoilTempSustainedDays(
      recentObservations168h,
      soilTempThresholdC,
    ),
    gdd24h: calculateGdd(next24h, gddBaseC),
    gdd72h: calculateGdd(next72h, gddBaseC),
    gddBaseC,
    provenance: {
      calculationMode: "observation-plus-hourly-forecast",
      forecastSampleCount24h: next24h.length,
      forecastSampleCount72h: next72h.length,
      forecastSampleCount168h: next168h.length,
      observationSampleCount72h: recentObservations72h.length,
      observationSampleCount168h: recentObservations168h.length,
      soilTempThresholdC,
      windowHours24: 24,
      windowHours72: 72,
      windowHours168: 168,
    },
  };
}
