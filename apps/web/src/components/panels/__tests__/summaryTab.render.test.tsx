import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { SummaryTab, type FieldSummaryProps } from "../SummaryTab";

function createFieldSummary(
  overrides: Partial<FieldSummaryProps> = {},
): FieldSummaryProps {
  return {
    name: "North Quarter",
    lld: "NW-25-010-17-W4",
    crop: "Canola",
    cropStage: "Vegetative",
    moisture: 0.48,
    cloudCover: "12%",
    surfaceMoisture: "34%",
    fieldState: "Stable",
    fieldStateColor: "#16a34a",
    rootMoisture: "48%",
    rootMoistureSub: "Root zone",
    trend: "Stable",
    trendSub: "No major shift",
    spread: "Moderate",
    spreadSub: "Across field",
    confidence: "High",
    confidenceSub: "Source-backed",
    moistureConfidenceLevel: "high",
    moistureDerivationMode: "source-backed",
    precipitation: "2.1 mm",
    precipitationSub: "Past 24h",
    nextRain: "Tomorrow",
    nextRainSub: "Light system",
    rainChance: "35%",
    rainChanceSub: "Next 24h",
    sevenDayTotal: "8.6 mm",
    sevenDayTotalSub: "Daily aggregate",
    alerts: [],
    outlook: [],
    ...overrides,
  };
}

test("SummaryTab renders the frost risk section when frost risk is present", () => {
  const markup = renderToStaticMarkup(
    <SummaryTab
      field={createFieldSummary({
        frostRisk: {
          minTempC: -3.2,
          frostNights: 2,
          probabilityPct: 68,
          freezeThawCycles: 1,
          verdict: "protect",
          verdictSub: "2 frost nights forecast",
        },
      })}
    />,
  );

  assert.match(markup, /FROST RISK/);
  assert.match(markup, /Protect/);
  assert.match(markup, /Frost Min \(7d\)/);
  assert.match(markup, /2 frost nights forecast/);
  assert.match(markup, /Freeze-Thaw Cycles/);
});

test("SummaryTab hides the frost risk section when no frost risk is present", () => {
  const markup = renderToStaticMarkup(
    <SummaryTab field={createFieldSummary({ frostRisk: null })} />,
  );

  assert.doesNotMatch(markup, /FROST RISK/);
});
