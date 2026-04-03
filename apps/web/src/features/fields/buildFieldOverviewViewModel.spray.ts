import {
  findSprayWindows,
  formatFieldLocalTime,
  type FieldLabelPoint,
  type FieldWeatherForecast,
  type SprayWindowBlock,
} from "@fieldpulse/module-weather";

export type SprayWindowRecommendationPresentation = {
  title: string;
  severity: "medium";
  urgency: string;
  dueDate: string;
  recommendation: string;
  explanation: string;
  whyNow: string;
  inspectFirst: string;
  confidence: string;
  signals: readonly {
    label: string;
    color: "green" | "yellow" | "red";
    detail: string;
  }[];
  tags: readonly {
    label: string;
    color: "green" | "yellow" | "red";
  }[];
};

function formatSignedRange(minValue: number, maxValue: number) {
  return `${minValue.toFixed(0)}–${maxValue.toFixed(0)}°C`;
}

function findFirstSprayWindow(
  forecasts: readonly FieldWeatherForecast[],
): SprayWindowBlock | null {
  return (
    findSprayWindows(forecasts, {
      horizonHours: 24,
      maxWindows: 1,
      consecutiveHours: 4,
    })[0] ?? null
  );
}

export function resolveSprayWindowRecommendation(input: {
  cropLabel: string;
  sprayWindowCount24h: number | null;
  forecasts: readonly FieldWeatherForecast[];
  fieldLabelPoint?: FieldLabelPoint | null;
  weatherSourceLabel?: string | null;
}): SprayWindowRecommendationPresentation | null {
  const sprayWindowCount24h =
    typeof input.sprayWindowCount24h === "number" && Number.isFinite(input.sprayWindowCount24h)
      ? input.sprayWindowCount24h
      : 0;

  if (sprayWindowCount24h < 1) {
    return null;
  }

  const firstWindow = findFirstSprayWindow(input.forecasts);
  if (!firstWindow) {
    return null;
  }

  const cropLabel = input.cropLabel.trim().length > 0 ? input.cropLabel : "This crop";
  const weatherSourceLabel = input.weatherSourceLabel?.trim() || "weather-backed";
  const startLabel = formatFieldLocalTime(firstWindow.startAt, input.fieldLabelPoint);
  const endLabel = formatFieldLocalTime(firstWindow.endAt, input.fieldLabelPoint);
  const precipLabel =
    firstWindow.maxPrecipProbabilityPct != null
      ? `${Math.round(firstWindow.maxPrecipProbabilityPct)}% rain chance`
      : "low rain chance";
  const windowCountLabel =
    sprayWindowCount24h === 1
      ? "1 spray window"
      : `${sprayWindowCount24h} spray windows`;

  return {
    title: "Spray window open",
    severity: "medium",
    urgency: "Ready",
    dueDate: "Within 24h",
    recommendation:
      "Use the next spray window if field checks and product timing still line up, then keep watching wind and precipitation as the block approaches.",
    explanation: `No confirmed finding is active yet. ${windowCountLabel} fit the current spray criteria in the next 24 hours, so this recommendation is advisory and based on hourly weather heuristics for ${cropLabel.toLowerCase()}.`,
    whyNow: `The earliest 4-hour spray block runs around ${startLabel} to ${endLabel}, with wind up to ${Math.round(firstWindow.maxWindKph)} km/h, ${precipLabel}, and temperatures around ${formatSignedRange(firstWindow.minAverageTempC, firstWindow.maxAverageTempC)}.`,
    inspectFirst:
      "Confirm the target crop stage and product label first, then re-check wind exposure on the most open field edges before committing the full pass.",
    confidence: "Heuristic watchlist · weather-backed",
    signals: [
      {
        label: windowCountLabel,
        color: "green",
        detail: `${startLabel} to ${endLabel} · ${weatherSourceLabel}`,
      },
      {
        label: `Wind ≤ ${Math.round(firstWindow.maxWindKph)} km/h`,
        color: "green",
        detail: `${precipLabel} · ${formatSignedRange(firstWindow.minAverageTempC, firstWindow.maxAverageTempC)}`,
      },
    ],
    tags: [
      { label: "Spray", color: "green" },
      { label: "Window open", color: "green" },
    ],
  };
}
