import assert from "node:assert/strict";
import test from "node:test";
import { describeSeedingAdvisoryNarrative } from "./describeSeedingAdvisoryNarrative";
import type { SeedingAdvisoryDecision } from "./resolveSeedingAdvisoryDecision";

function createDecision(
  overrides: Partial<SeedingAdvisoryDecision>,
): SeedingAdvisoryDecision {
  return {
    verdict: "too-early",
    reasonCode: "soil-below-threshold",
    thresholdC: 7,
    requiredDays: 3,
    soilTempCurrentC: 4.8,
    soilTempSustainedDays: 0,
    surfaceMoisturePct: 58,
    frostRiskMinTempC7d: 2.5,
    frostRiskNights7d: 0,
    frostProbabilityPct7d: 8,
    fieldAccessVerdict: "workable",
    soilReady: false,
    tooDry: false,
    tooWet: false,
    fieldAccessBlocked: false,
    fieldAccessMarginal: false,
    frostDamageRisk: false,
    frostKillRisk: false,
    frostBlocked: false,
    ...overrides,
  };
}

test("describeSeedingAdvisoryNarrative builds a frost-hold narrative from the shared decision", () => {
  const narrative = describeSeedingAdvisoryNarrative({
    decision: createDecision({
      verdict: "hold",
      reasonCode: "frost-risk",
      thresholdC: 5,
      soilTempCurrentC: 6.4,
      soilTempSustainedDays: 3,
      frostRiskMinTempC7d: -2.5,
      frostRiskNights7d: 1,
      frostProbabilityPct7d: 43,
      soilReady: true,
      frostDamageRisk: true,
      frostBlocked: true,
    }),
    cropLabel: "Wheat",
    frostDamageTempC: -2,
    surfaceMoistureMinPct: 40,
    fieldAccessExplanation: "Surface 61% · P72h 4mm · 1 thaw cycle",
  });

  assert.equal(narrative.uiTitle, "Hold seeding for frost risk");
  assert.equal(narrative.pdfTitle, "Hold Seeding for Frost Risk — Wheat");
  assert.equal(narrative.uiSeverity, "medium");
  assert.equal(narrative.pdfSeverity, "warning");
  assert.match(narrative.whyNow, /-2\.5°C/);
  assert.match(narrative.whyNow, /43% probability/i);
});

test("describeSeedingAdvisoryNarrative builds a dry-surface hold narrative from the shared decision", () => {
  const narrative = describeSeedingAdvisoryNarrative({
    decision: createDecision({
      verdict: "hold",
      reasonCode: "surface-too-dry",
      thresholdC: 5,
      soilTempCurrentC: 6.1,
      soilTempSustainedDays: 3,
      surfaceMoisturePct: 31,
      soilReady: true,
      tooDry: true,
    }),
    cropLabel: "Canola",
    frostDamageTempC: -1,
    surfaceMoistureMinPct: 40,
    fieldAccessExplanation: "Surface 31% · P72h 1mm · 0 thaw cycles",
  });

  assert.equal(narrative.uiTitle, "Hold seeding for field fit");
  assert.equal(narrative.pdfTitle, "Hold Seeding for Surface Moisture — Canola");
  assert.match(narrative.whyNow, /31%/);
  assert.match(narrative.whyNow, /40% germination floor/i);
});

test("describeSeedingAdvisoryNarrative builds a ready narrative from the shared decision", () => {
  const narrative = describeSeedingAdvisoryNarrative({
    decision: createDecision({
      verdict: "seed-now",
      reasonCode: "ready",
      thresholdC: 4,
      soilTempCurrentC: 6.2,
      soilTempSustainedDays: 3,
      soilReady: true,
      frostRiskMinTempC7d: 2.8,
      frostRiskNights7d: 0,
      frostProbabilityPct7d: 5,
    }),
    cropLabel: "Peas",
    frostDamageTempC: -2,
    surfaceMoistureMinPct: 40,
    fieldAccessExplanation: "Surface 62% · P72h 3mm · 1 thaw cycle",
  });

  assert.equal(narrative.uiTitle, "Seeding window open");
  assert.equal(narrative.pdfTitle, "Seeding Window Open — Peas");
  assert.equal(narrative.pdfSeverity, "info");
  assert.match(narrative.whyNow, /cleared 4°C for 3d/i);
  assert.match(narrative.recommendation, /Seed now/i);
});
