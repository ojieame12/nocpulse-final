export type FrostRiskNarrative = {
  signalNote: string;
  sevenDayLowSub: string;
  probabilitySub: string;
  riskNightsSub: string;
};

export function describeFrostRiskNarrative(input: {
  minTempC: number | null;
  probabilityPct7d: number | null;
  riskNights7d: number | null;
}): FrostRiskNarrative {
  const minTempC = input.minTempC;
  const probabilityPct7d = input.probabilityPct7d;
  const riskNights7d = input.riskNights7d;

  return {
    signalNote:
      minTempC == null
        ? "Data unavailable"
        : minTempC < -5
          ? "Hard frost. Significant crop damage risk."
          : minTempC < 0
            ? "Frost likely. Protect sensitive crops."
            : minTempC < 2
              ? "Near-frost. Monitor overnight lows."
              : "No frost risk in forecast.",
    sevenDayLowSub:
      minTempC == null
        ? "No 7-day frost signal available"
        : minTempC < -5
          ? "Hard frost expected this week"
          : minTempC < 0
            ? "Frost expected this week"
            : minTempC < 2
              ? "Near-frost conditions possible"
              : "No frost risk in 7-day window",
    probabilitySub:
      probabilityPct7d == null
        ? "Probability model unavailable"
        : probabilityPct7d > 60
          ? "Very likely — delay sensitive operations"
          : probabilityPct7d > 30
            ? "Moderate risk — monitor forecasts daily"
            : "Low probability — conditions trending safe",
    riskNightsSub:
      riskNights7d == null
        ? "Night-count signal unavailable"
        : riskNights7d >= 4
          ? "Persistent frost pattern — not safe for tender seedlings"
          : riskNights7d >= 2
            ? "Intermittent frost — watch overnight lows"
            : riskNights7d >= 1
              ? "Isolated occurrence only"
              : "No frost-risk nights in the 7-day window",
  };
}
