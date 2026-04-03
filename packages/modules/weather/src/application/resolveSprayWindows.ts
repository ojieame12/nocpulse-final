import type { FieldWeatherForecast } from "../contracts/FieldWeatherForecast";

export type FieldLabelPoint = readonly [longitude: number, latitude: number];

export type SprayWindowThresholds = {
  maxWindKph: number;
  maxPrecipProbabilityPct: number;
  maxPrecipitationMm: number;
  minAverageTempC: number;
  maxAverageTempC: number;
};

export type SprayWindowBlock = {
  startAt: string;
  endAt: string;
  maxWindKph: number;
  maxPrecipProbabilityPct: number | null;
  minAverageTempC: number;
  maxAverageTempC: number;
};

export type FindSprayWindowsOptions = {
  horizonHours?: number;
  maxWindows?: number;
  consecutiveHours?: number;
  thresholds?: SprayWindowThresholds;
};

export const DEFAULT_SPRAY_WINDOW_THRESHOLDS: SprayWindowThresholds = {
  maxWindKph: 18,
  maxPrecipProbabilityPct: 20,
  maxPrecipitationMm: 1,
  minAverageTempC: 10,
  maxAverageTempC: 30,
};

function averageTemperature(forecast: FieldWeatherForecast) {
  return (forecast.airTemperatureMinC + forecast.airTemperatureMaxC) / 2;
}

function addHoursToIso(value: string, hours: number) {
  return new Date(Date.parse(value) + hours * 60 * 60 * 1000).toISOString();
}

function hasFiniteLabelPoint(
  labelPoint?: FieldLabelPoint | null,
): labelPoint is FieldLabelPoint {
  return (
    Array.isArray(labelPoint) &&
    labelPoint.length === 2 &&
    Number.isFinite(labelPoint[0]) &&
    Number.isFinite(labelPoint[1])
  );
}

export function isSprayEligibleForecast(
  forecast: FieldWeatherForecast,
  thresholds: SprayWindowThresholds = DEFAULT_SPRAY_WINDOW_THRESHOLDS,
) {
  const averageTempC = averageTemperature(forecast);

  return (
    forecast.windSpeedKph <= thresholds.maxWindKph &&
    (forecast.precipitationProbabilityPct ?? 0) < thresholds.maxPrecipProbabilityPct &&
    forecast.precipitationMm < thresholds.maxPrecipitationMm &&
    averageTempC >= thresholds.minAverageTempC &&
    averageTempC <= thresholds.maxAverageTempC
  );
}

export function findSprayWindows(
  forecasts: readonly FieldWeatherForecast[],
  options: FindSprayWindowsOptions = {},
): readonly SprayWindowBlock[] {
  const horizonHours = options.horizonHours ?? 24;
  const maxWindows = options.maxWindows ?? 1;
  const consecutiveHours = options.consecutiveHours ?? 4;
  const thresholds = options.thresholds ?? DEFAULT_SPRAY_WINDOW_THRESHOLDS;
  const horizon = forecasts.slice(0, horizonHours);
  const windows: SprayWindowBlock[] = [];

  let index = 0;
  while (index <= horizon.length - consecutiveHours && windows.length < maxWindows) {
    const block = horizon.slice(index, index + consecutiveHours);

    if (
      block.length < consecutiveHours ||
      block.some((forecast) => !isSprayEligibleForecast(forecast, thresholds))
    ) {
      index += 1;
      continue;
    }

    const averageTemperatures = block.map(averageTemperature);
    const precipProbabilities = block
      .map((forecast) => forecast.precipitationProbabilityPct)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

    windows.push({
      startAt: block[0]!.validAt,
      endAt: addHoursToIso(block[block.length - 1]!.validAt, 1),
      maxWindKph: Math.max(...block.map((forecast) => forecast.windSpeedKph)),
      maxPrecipProbabilityPct:
        precipProbabilities.length > 0 ? Math.max(...precipProbabilities) : null,
      minAverageTempC: Math.min(...averageTemperatures),
      maxAverageTempC: Math.max(...averageTemperatures),
    });
    index += consecutiveHours;
  }

  return windows;
}

export function resolveFieldTimeZone(labelPoint?: FieldLabelPoint | null): string {
  if (!hasFiniteLabelPoint(labelPoint)) {
    return "UTC";
  }

  const [longitude, latitude] = labelPoint;

  // Saskatchewan uses CST year-round. This is the highest-impact case for launch users.
  if (latitude >= 48.8 && latitude <= 60.2 && longitude >= -110.1 && longitude <= -101.2) {
    return "America/Regina";
  }

  if (latitude >= 24 && latitude <= 84.5) {
    if (longitude >= -141 && longitude < -114) {
      return "America/Vancouver";
    }
    if (longitude >= -114 && longitude < -101.2) {
      return "America/Edmonton";
    }
    if (longitude >= -101.2 && longitude < -86) {
      return "America/Winnipeg";
    }
    if (longitude >= -86 && longitude < -67) {
      return "America/Toronto";
    }
    if (longitude >= -67 && longitude < -52) {
      return "America/Halifax";
    }
  }

  return "UTC";
}

export function formatFieldLocalTime(
  value: string,
  labelPoint?: FieldLabelPoint | null,
): string {
  const date = new Date(value);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: resolveFieldTimeZone(labelPoint),
    timeZoneName: "short",
  });

  try {
    return formatter.format(date);
  } catch {
    return new Intl.DateTimeFormat("en-CA", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "UTC",
      timeZoneName: "short",
    }).format(date);
  }
}
