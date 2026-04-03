import { describeFrostRiskNarrative } from "./describeFrostRiskNarrative";

export type WeatherSignalNarrativeKey =
  | "crop-water-demand"
  | "peak-vpd-24h"
  | "water-balance-24h"
  | "water-balance-72h"
  | "frost-risk"
  | "leaf-wet-hours-24h"
  | "spray-windows-24h"
  | "gdd-72h";

export function describeWeatherSignalNarrative(
  key: WeatherSignalNarrativeKey,
  value: number | null,
): string {
  if (value === null) {
    return "Data unavailable";
  }

  switch (key) {
    case "crop-water-demand":
      if (value < 0.4) return "Low crop water demand. Fungal disease risk elevated.";
      if (value > 1.5) return "High crop water demand. Rapid transpiration likely.";
      return "Within a comfortable crop water demand range.";
    case "peak-vpd-24h":
      if (value > 2.0) return "Extreme crop water demand forecast. Expect crop stress.";
      if (value > 1.2) return "Elevated peak crop water demand. Monitor plant turgor.";
      return "Peak crop water demand is within range.";
    case "water-balance-24h":
      if (value < -5) return "Significant deficit. Irrigation needed soon.";
      if (value < 0) return "Mild deficit. Acceptable short-term.";
      return "Positive balance. Adequate moisture supply.";
    case "water-balance-72h":
      if (value < -10) return "Severe 3-day deficit. Prioritize irrigation.";
      if (value < -3) return "Moderate deficit over 72h.";
      return "3-day balance is positive.";
    case "frost-risk":
      return describeFrostRiskNarrative({
        minTempC: value,
        probabilityPct7d: null,
        riskNights7d: null,
      }).signalNote;
    case "leaf-wet-hours-24h":
      if (value > 12) return "Extended wetness. High disease pressure.";
      if (value > 6) return "Moderate leaf wetness. Scout for disease.";
      return "Leaf wetness within safe range.";
    case "spray-windows-24h":
      if (value === 0) return "No spray windows. Conditions unfavorable.";
      if (value < 2) return "Limited windows. Plan applications carefully.";
      return "Multiple spray windows available.";
    case "gdd-72h":
      if (value < 5) return "Minimal heat accumulation. Growth stalled.";
      return "Accumulating growing degree days.";
  }
}
