import assert from "node:assert/strict";
import test from "node:test";
import type { FrostRiskRulePack, SeedingThresholdRulePack } from "../contracts/RulePack";
import {
  resolveFieldAccessDecision,
  resolveSeedingAdvisoryDecision,
} from "./resolveSeedingAdvisoryDecision";

const SEEDING_THRESHOLDS: SeedingThresholdRulePack = {
  dedupeKey: "test-seeding",
  label: "Test seeding thresholds",
  soilTempMinC: 5,
  sustainedDays: 3,
  surfaceMoistureMinPct: 40,
  surfaceMoistureMaxPct: 85,
  recentPrecipWarnMm72h: 10,
  recentPrecipBlockMm72h: 20,
  freezeThawWarnCount: 2,
  freezeThawBlockCount: 4,
};

const FROST_THRESHOLDS: FrostRiskRulePack = {
  dedupeKey: "test-frost",
  label: "Test frost thresholds",
  damageTempC: -2,
  killTempC: -4,
};

test("resolveFieldAccessDecision classifies workable, marginal, and blocked field access", () => {
  assert.equal(
    resolveFieldAccessDecision({
      surfaceMoisturePct: 62,
      recentPrecipTotal72hMm: 4,
      freezeThawCycles7d: 1,
      thresholds: SEEDING_THRESHOLDS,
    })?.verdict,
    "workable",
  );

  assert.equal(
    resolveFieldAccessDecision({
      surfaceMoisturePct: 72,
      recentPrecipTotal72hMm: 11,
      freezeThawCycles7d: 2,
      thresholds: SEEDING_THRESHOLDS,
    })?.verdict,
    "marginal",
  );

  assert.equal(
    resolveFieldAccessDecision({
      surfaceMoisturePct: 88,
      recentPrecipTotal72hMm: 16,
      freezeThawCycles7d: 5,
      thresholds: SEEDING_THRESHOLDS,
    })?.verdict,
    "wait",
  );
});

test("resolveSeedingAdvisoryDecision returns too-early when soil is below threshold", () => {
  const decision = resolveSeedingAdvisoryDecision({
    seedingThresholds: {
      ...SEEDING_THRESHOLDS,
      soilTempMinC: 7,
    },
    frostThresholds: {
      ...FROST_THRESHOLDS,
      damageTempC: -1,
      killTempC: -3,
    },
    soilTemp6cmCurrentC: 4.8,
    soilTemp6cmSustainedDays: 0,
    surfaceMoisturePct: 58,
    fieldAccessVerdict: "workable",
    frostRiskMinTempC7d: 2.5,
    frostRiskNights7d: 0,
    frostProbabilityPct7d: 8,
  });

  assert.equal(decision?.verdict, "too-early");
  assert.equal(decision?.reasonCode, "soil-below-threshold");
  assert.equal(decision?.thresholdC, 7);
});

test("resolveSeedingAdvisoryDecision returns hold when frost risk remains", () => {
  const decision = resolveSeedingAdvisoryDecision({
    seedingThresholds: SEEDING_THRESHOLDS,
    frostThresholds: FROST_THRESHOLDS,
    soilTemp6cmCurrentC: 6.4,
    soilTemp6cmSustainedDays: 3,
    surfaceMoisturePct: 61,
    fieldAccessVerdict: "workable",
    frostRiskMinTempC7d: -2.5,
    frostRiskNights7d: 1,
    frostProbabilityPct7d: 43,
  });

  assert.equal(decision?.verdict, "hold");
  assert.equal(decision?.reasonCode, "frost-risk");
  assert.equal(decision?.frostDamageRisk, true);
});

test("resolveSeedingAdvisoryDecision returns hold when field access is constrained", () => {
  const decision = resolveSeedingAdvisoryDecision({
    seedingThresholds: SEEDING_THRESHOLDS,
    frostThresholds: FROST_THRESHOLDS,
    soilTemp6cmCurrentC: 6.2,
    soilTemp6cmSustainedDays: 3,
    surfaceMoisturePct: 71,
    fieldAccessVerdict: "marginal",
    frostRiskMinTempC7d: 2.8,
    frostRiskNights7d: 0,
    frostProbabilityPct7d: 10,
  });

  assert.equal(decision?.verdict, "hold");
  assert.equal(decision?.reasonCode, "field-access");
  assert.equal(decision?.fieldAccessMarginal, true);
});

test("resolveSeedingAdvisoryDecision returns seed-now when soil, frost, and access align", () => {
  const decision = resolveSeedingAdvisoryDecision({
    seedingThresholds: {
      ...SEEDING_THRESHOLDS,
      soilTempMinC: 4,
    },
    frostThresholds: FROST_THRESHOLDS,
    soilTemp6cmCurrentC: 6.2,
    soilTemp6cmSustainedDays: 3,
    surfaceMoisturePct: 62,
    fieldAccessVerdict: "workable",
    frostRiskMinTempC7d: 2.8,
    frostRiskNights7d: 0,
    frostProbabilityPct7d: 5,
  });

  assert.equal(decision?.verdict, "seed-now");
  assert.equal(decision?.reasonCode, "ready");
});
