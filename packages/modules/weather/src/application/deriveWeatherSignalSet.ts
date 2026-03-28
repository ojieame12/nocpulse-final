import type { UpsertFieldWeatherDerivedSignalSetInput } from "../contracts/UpsertFieldWeatherDerivedSignalSetInput";
import type { FieldWeatherForecast } from "../contracts/FieldWeatherForecast";
import type { FieldWeatherObservation } from "../contracts/FieldWeatherObservation";

const DEFAULT_SIGNAL_VERSION = "weather-derived-signals-v1";
const DEFAULT_GDD_BASE_C = 5;

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

export function deriveWeatherSignalSet(input: {
  workspaceId: string;
  fieldId: string;
  observation: FieldWeatherObservation;
  forecasts: readonly FieldWeatherForecast[];
  signalVersion?: string;
  gddBaseC?: number;
}): UpsertFieldWeatherDerivedSignalSetInput {
  const next24h = selectWindow(input.forecasts, 24);
  const next72h = selectWindow(input.forecasts, 72);
  const gddBaseC = input.gddBaseC ?? DEFAULT_GDD_BASE_C;

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
    frostRiskMinTempC:
      next24h.length === 0
        ? null
        : roundTo(
            Math.min(
              ...next24h.map((forecast) => forecast.airTemperatureMinC),
            ),
            2,
          ),
    gdd24h: calculateGdd(next24h, gddBaseC),
    gdd72h: calculateGdd(next72h, gddBaseC),
    gddBaseC,
    provenance: {
      calculationMode: "observation-plus-hourly-forecast",
      forecastSampleCount24h: next24h.length,
      forecastSampleCount72h: next72h.length,
      windowHours24: 24,
      windowHours72: 72,
    },
  };
}
