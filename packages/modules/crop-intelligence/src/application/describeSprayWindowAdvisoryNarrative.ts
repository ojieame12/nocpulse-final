import type { SprayWindowBlock } from "@fieldpulse/module-weather";

export type SprayWindowAdvisoryNarrative = {
  uiTitle: string;
  uiSeverity: "medium";
  urgency: string;
  dueDate: string;
  recommendation: string;
  explanation: string;
  whyNow: string;
  inspectFirst: string;
  windowCountLabel: string;
  precipLabel: string;
  temperatureRangeLabel: string;
  pdfCardTitle: string;
  pdfBody: string;
  pdfAction: string;
};

export type DescribeSprayWindowAdvisoryNarrativeInput = {
  cropLabel: string;
  sprayWindowCount24h: number;
  firstWindow: Pick<
    SprayWindowBlock,
    | "startAt"
    | "endAt"
    | "maxWindKph"
    | "maxPrecipProbabilityPct"
    | "minAverageTempC"
    | "maxAverageTempC"
  >;
  startLabel: string;
  endLabel: string;
};

function formatSignedRange(minValue: number, maxValue: number) {
  return `${minValue.toFixed(0)}–${maxValue.toFixed(0)}°C`;
}

export function describeSprayWindowAdvisoryNarrative(
  input: DescribeSprayWindowAdvisoryNarrativeInput,
): SprayWindowAdvisoryNarrative {
  const cropLabel = input.cropLabel.trim().length > 0 ? input.cropLabel : "This crop";
  const cropLabelLower = cropLabel.toLowerCase();
  const sprayWindowCount24h =
    Number.isFinite(input.sprayWindowCount24h) && input.sprayWindowCount24h > 0
      ? Math.round(input.sprayWindowCount24h)
      : 1;
  const windowCountLabel =
    sprayWindowCount24h === 1
      ? "1 spray window"
      : `${sprayWindowCount24h} spray windows`;
  const precipLabel =
    input.firstWindow.maxPrecipProbabilityPct != null
      ? `${Math.round(input.firstWindow.maxPrecipProbabilityPct)}% rain chance`
      : "low rain chance";
  const temperatureRangeLabel = formatSignedRange(
    input.firstWindow.minAverageTempC,
    input.firstWindow.maxAverageTempC,
  );
  const pdfBody =
    `Wind up to ${Math.round(input.firstWindow.maxWindKph)} km/h, ` +
    `${precipLabel}, and temperatures around ${temperatureRangeLabel}.`;

  return {
    uiTitle: "Spray window open",
    uiSeverity: "medium",
    urgency: "Ready",
    dueDate: "Within 24h",
    recommendation:
      "Use the next spray window if field checks and product timing still line up, then keep watching wind and precipitation as the block approaches.",
    explanation:
      `No confirmed finding is active yet. ${windowCountLabel} fit the current spray criteria ` +
      `in the next 24 hours, so this recommendation is advisory and based on hourly weather heuristics ` +
      `for ${cropLabelLower}.`,
    whyNow:
      `The earliest 4-hour spray block runs around ${input.startLabel} to ${input.endLabel}. ` +
      pdfBody,
    inspectFirst:
      "Confirm the target crop stage and product label first, then re-check wind exposure on the most open field edges before committing the full pass.",
    windowCountLabel,
    precipLabel,
    temperatureRangeLabel,
    pdfCardTitle: `Best window: ${input.startLabel} – ${input.endLabel}`,
    pdfBody,
    pdfAction:
      "Confirm the target crop stage and product label first, then re-check wind exposure on the most open field edges before committing the full pass.",
  };
}
