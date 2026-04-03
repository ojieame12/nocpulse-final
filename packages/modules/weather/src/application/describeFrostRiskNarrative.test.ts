import assert from "node:assert/strict";
import test from "node:test";
import { describeFrostRiskNarrative } from "./describeFrostRiskNarrative";

test("describeFrostRiskNarrative returns hard-frost copy for severe lows", () => {
  assert.deepEqual(
    describeFrostRiskNarrative({
      minTempC: -6.4,
      probabilityPct7d: 72,
      riskNights7d: 5,
    }),
    {
      signalNote: "Hard frost. Significant crop damage risk.",
      sevenDayLowSub: "Hard frost expected this week",
      probabilitySub: "Very likely — delay sensitive operations",
      riskNightsSub: "Persistent frost pattern — not safe for tender seedlings",
    },
  );
});

test("describeFrostRiskNarrative returns watch copy for near-frost conditions", () => {
  assert.deepEqual(
    describeFrostRiskNarrative({
      minTempC: 1.4,
      probabilityPct7d: 38,
      riskNights7d: 2,
    }),
    {
      signalNote: "Near-frost. Monitor overnight lows.",
      sevenDayLowSub: "Near-frost conditions possible",
      probabilitySub: "Moderate risk — monitor forecasts daily",
      riskNightsSub: "Intermittent frost — watch overnight lows",
    },
  );
});

test("describeFrostRiskNarrative returns clear copy when frost signals are absent", () => {
  assert.deepEqual(
    describeFrostRiskNarrative({
      minTempC: 3.2,
      probabilityPct7d: 12,
      riskNights7d: 0,
    }),
    {
      signalNote: "No frost risk in forecast.",
      sevenDayLowSub: "No frost risk in 7-day window",
      probabilitySub: "Low probability — conditions trending safe",
      riskNightsSub: "No frost-risk nights in the 7-day window",
    },
  );
});
