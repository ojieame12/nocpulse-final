import assert from "node:assert/strict";
import test from "node:test";
import { describeFrostRiskSummary } from "./describeFrostRiskSummary";

test("describeFrostRiskSummary formats a 7-day frost watch consistently", () => {
  const summary = describeFrostRiskSummary({
    frostRiskMinTempC: -0.8,
    frostRiskMinTempC7d: -1.8,
    frostRiskNights7d: 2,
    frostProbabilityPct7d: 43,
  });

  assert.deepEqual(summary, {
    minTempC: -1.8,
    horizonLabel: "next 7d",
    detailLabel: "Lowest forecast low",
    probabilityLabel: "43% probability",
    riskNightsLabel: "2 frost-risk nights next 7d",
    riskNightsCompactLabel: "2 nights next 7d",
    reportLabel: "Frost Min 7d (2n · 43%)",
    compactMinimumLabel: "Min -1.8°C · 2 nights next 7d · 43% probability",
  });
});

test("describeFrostRiskSummary falls back to the overnight horizon when only 24-hour data exists", () => {
  const summary = describeFrostRiskSummary({
    frostRiskMinTempC: 1.2,
    frostRiskMinTempC7d: null,
    frostRiskNights7d: null,
    frostProbabilityPct7d: null,
  });

  assert.deepEqual(summary, {
    minTempC: 1.2,
    horizonLabel: "next 24h",
    detailLabel: "Next overnight minimum",
    probabilityLabel: null,
    riskNightsLabel: null,
    riskNightsCompactLabel: null,
    reportLabel: "Frost Min",
    compactMinimumLabel: "Min 1.2°C next 24h",
  });
});

test("describeFrostRiskSummary keeps a 7-day horizon when only nights or probability are available", () => {
  const summary = describeFrostRiskSummary({
    frostRiskMinTempC: 0.4,
    frostRiskMinTempC7d: null,
    frostRiskNights7d: 1,
    frostProbabilityPct7d: 25,
  });

  assert.equal(summary.horizonLabel, "next 7d");
  assert.equal(summary.detailLabel, "Lowest forecast low");
  assert.equal(summary.riskNightsLabel, "1 frost-risk night next 7d");
  assert.equal(summary.reportLabel, "Frost Min 7d (1n · 25%)");
  assert.equal(summary.compactMinimumLabel, "Min 0.4°C · 1 night next 7d · 25% probability");
});
