import type { FieldWeatherForecast } from "../contracts/FieldWeatherForecast";
import { resolveFieldTimeZone, type FieldLabelPoint } from "./resolveSprayWindows";

export type ForecastDaySummary = {
  dateKey: string;
  label: string;
  startAt: string;
  airTemperatureMinC: number | null;
  airTemperatureMaxC: number | null;
  precipitationProbabilityPct: number | null;
  precipitationMm: number;
  windSpeedKph: number | null;
  forecastCount: number;
};

export type SummarizeForecastDaysOptions = {
  fieldLabelPoint?: FieldLabelPoint | null;
  limitDays?: number;
};

function buildDateKey(value: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));

  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";

  return `${year}-${month}-${day}`;
}

function buildDateLabel(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function summarizeForecastDays(
  forecasts: readonly FieldWeatherForecast[],
  options: SummarizeForecastDaysOptions = {},
): readonly ForecastDaySummary[] {
  if (forecasts.length === 0) {
    return [];
  }

  const timeZone = resolveFieldTimeZone(options.fieldLabelPoint);
  const limitDays = options.limitDays ?? Number.POSITIVE_INFINITY;
  const ordered = [...forecasts].sort((left, right) => Date.parse(left.validAt) - Date.parse(right.validAt));
  const summaries = new Map<string, ForecastDaySummary>();

  for (const forecast of ordered) {
    const dateKey = buildDateKey(forecast.validAt, timeZone);
    const existing = summaries.get(dateKey);

    if (!existing) {
      if (summaries.size >= limitDays) {
        break;
      }

      summaries.set(dateKey, {
        dateKey,
        label: buildDateLabel(forecast.validAt, timeZone),
        startAt: forecast.validAt,
        airTemperatureMinC:
          typeof forecast.airTemperatureMinC === "number" ? forecast.airTemperatureMinC : null,
        airTemperatureMaxC:
          typeof forecast.airTemperatureMaxC === "number" ? forecast.airTemperatureMaxC : null,
        precipitationProbabilityPct:
          typeof forecast.precipitationProbabilityPct === "number"
            ? forecast.precipitationProbabilityPct
            : null,
        precipitationMm:
          typeof forecast.precipitationMm === "number" ? forecast.precipitationMm : 0,
        windSpeedKph:
          typeof forecast.windSpeedKph === "number" ? forecast.windSpeedKph : null,
        forecastCount: 1,
      });
      continue;
    }

    existing.airTemperatureMinC =
      typeof forecast.airTemperatureMinC === "number"
        ? existing.airTemperatureMinC == null
          ? forecast.airTemperatureMinC
          : Math.min(existing.airTemperatureMinC, forecast.airTemperatureMinC)
        : existing.airTemperatureMinC;
    existing.airTemperatureMaxC =
      typeof forecast.airTemperatureMaxC === "number"
        ? existing.airTemperatureMaxC == null
          ? forecast.airTemperatureMaxC
          : Math.max(existing.airTemperatureMaxC, forecast.airTemperatureMaxC)
        : existing.airTemperatureMaxC;
    existing.precipitationProbabilityPct =
      typeof forecast.precipitationProbabilityPct === "number"
        ? existing.precipitationProbabilityPct == null
          ? forecast.precipitationProbabilityPct
          : Math.max(existing.precipitationProbabilityPct, forecast.precipitationProbabilityPct)
        : existing.precipitationProbabilityPct;
    existing.precipitationMm +=
      typeof forecast.precipitationMm === "number" ? forecast.precipitationMm : 0;
    existing.windSpeedKph =
      typeof forecast.windSpeedKph === "number"
        ? existing.windSpeedKph == null
          ? forecast.windSpeedKph
          : Math.max(existing.windSpeedKph, forecast.windSpeedKph)
        : existing.windSpeedKph;
    existing.forecastCount += 1;
  }

  return [...summaries.values()];
}
