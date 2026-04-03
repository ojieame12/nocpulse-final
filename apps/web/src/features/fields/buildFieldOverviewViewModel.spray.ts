import { describeSprayWindowAdvisoryNarrative } from "@fieldpulse/module-crop-intelligence";
import {
  findSprayWindows,
  formatFieldLocalTime,
  type FieldLabelPoint,
  type FieldTimeZone,
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
  fieldTimeZone?: FieldTimeZone | null;
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
  const startLabel = formatFieldLocalTime(firstWindow.startAt, {
    fieldTimeZone: input.fieldTimeZone,
    fieldLabelPoint: input.fieldLabelPoint,
  });
  const endLabel = formatFieldLocalTime(firstWindow.endAt, {
    fieldTimeZone: input.fieldTimeZone,
    fieldLabelPoint: input.fieldLabelPoint,
  });
  const narrative = describeSprayWindowAdvisoryNarrative({
    cropLabel,
    sprayWindowCount24h,
    firstWindow,
    startLabel,
    endLabel,
  });

  return {
    title: narrative.uiTitle,
    severity: narrative.uiSeverity,
    urgency: narrative.urgency,
    dueDate: narrative.dueDate,
    recommendation: narrative.recommendation,
    explanation: narrative.explanation,
    whyNow: narrative.whyNow,
    inspectFirst: narrative.inspectFirst,
    confidence: "Heuristic watchlist · weather-backed",
    signals: [
      {
        label: narrative.windowCountLabel,
        color: "green",
        detail: `${startLabel} to ${endLabel} · ${weatherSourceLabel}`,
      },
      {
        label: `Wind ≤ ${Math.round(firstWindow.maxWindKph)} km/h`,
        color: "green",
        detail: `${narrative.precipLabel} · ${narrative.temperatureRangeLabel}`,
      },
    ],
    tags: [
      { label: "Spray", color: "green" },
      { label: "Window open", color: "green" },
    ],
  };
}
