import type { FieldWeatherDerivedSignalSet } from "../contracts/FieldWeatherDerivedSignalSet";

type FrostSignalInput = Pick<
  FieldWeatherDerivedSignalSet,
  | "frostRiskMinTempC"
  | "frostRiskMinTempC7d"
  | "frostRiskNights7d"
  | "frostProbabilityPct7d"
>;

export type FrostRiskSummary = {
  minTempC: number | null;
  horizonLabel: "next 7d" | "next 24h";
  detailLabel: string;
  probabilityLabel: string | null;
  riskNightsLabel: string | null;
  riskNightsCompactLabel: string | null;
  reportLabel: string;
  compactMinimumLabel: string | null;
};

function formatProbabilityLabel(value: number | null) {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }

  return `${Math.round(value)}% probability`;
}

export function describeFrostRiskSummary(
  input: FrostSignalInput,
): FrostRiskSummary {
  const usesSevenDayHorizon =
    input.frostRiskMinTempC7d != null ||
    input.frostRiskNights7d != null ||
    input.frostProbabilityPct7d != null;
  const minTempC =
    input.frostRiskMinTempC7d ??
    input.frostRiskMinTempC ??
    null;
  const horizonLabel = usesSevenDayHorizon ? "next 7d" : "next 24h";
  const detailLabel = usesSevenDayHorizon
    ? "Lowest forecast low"
    : "Next overnight minimum";
  const probabilityLabel = formatProbabilityLabel(input.frostProbabilityPct7d ?? null);
  const frostRiskNights7d = input.frostRiskNights7d ?? null;
  const riskNightsLabel =
    frostRiskNights7d != null && frostRiskNights7d > 0
      ? `${frostRiskNights7d} frost-risk night${frostRiskNights7d === 1 ? "" : "s"} ${horizonLabel}`
      : null;
  const riskNightsCompactLabel =
    frostRiskNights7d != null && frostRiskNights7d > 0
      ? `${frostRiskNights7d} night${frostRiskNights7d === 1 ? "" : "s"} ${horizonLabel}`
      : null;
  const reportLabel = usesSevenDayHorizon
    ? frostRiskNights7d != null && frostRiskNights7d > 0
      ? `Frost Min 7d (${frostRiskNights7d}n${input.frostProbabilityPct7d != null ? ` · ${Math.round(input.frostProbabilityPct7d)}%` : ""})`
      : input.frostProbabilityPct7d != null
        ? `Frost Min 7d (${Math.round(input.frostProbabilityPct7d)}%)`
        : "Frost Min 7d"
    : "Frost Min";
  const compactMinimumLabel =
    minTempC == null
      ? null
      : riskNightsCompactLabel
        ? `Min ${minTempC.toFixed(1)}°C · ${riskNightsCompactLabel}${probabilityLabel ? ` · ${probabilityLabel}` : ""}`
        : `Min ${minTempC.toFixed(1)}°C ${horizonLabel}${probabilityLabel ? ` · ${probabilityLabel}` : ""}`;

  return {
    minTempC,
    horizonLabel,
    detailLabel,
    probabilityLabel,
    riskNightsLabel,
    riskNightsCompactLabel,
    reportLabel,
    compactMinimumLabel,
  };
}
