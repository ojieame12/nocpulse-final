import assert from "node:assert/strict";
import test from "node:test";
import type { SeedingThresholdRulePack } from "@fieldpulse/module-crop-intelligence";
import {
  isSpringSeedingContext,
  resolveFieldAccessPresentation,
  resolveSeedingRecommendation,
  resolveSoilTempPresentation,
} from "./buildFieldOverviewViewModel.spring";

const PRESEED_STAGE = {
  displayStageLabel: "Pre Seed",
  ruleStage: "pre-seed",
  thresholdStageLabel: "Pre Seed stage",
  accumulatedGddLabel: "—",
  gddUnitLabel: "Season heat units unavailable (base 5°C)",
  stageSourceLabel: "Weather-derived stage still initializing",
  hasCredibleAccumulatedGdd: false,
} as const;

const STANDARD_SEEDING_THRESHOLDS: SeedingThresholdRulePack = {
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

test("isSpringSeedingContext detects early or unverified crop stages", () => {
  assert.equal(
    isSpringSeedingContext({
      ...PRESEED_STAGE,
    }),
    true,
  );

  assert.equal(
    isSpringSeedingContext({
      displayStageLabel: "Flowering",
      ruleStage: "flowering",
      thresholdStageLabel: "Flowering stage",
      accumulatedGddLabel: "622",
      gddUnitLabel: "Heat units accumulated (base 5°C)",
      stageSourceLabel: "Weather-derived crop stage",
      hasCredibleAccumulatedGdd: true,
    }),
    false,
  );
});

test("resolveSoilTempPresentation classifies below-threshold and sustained windows", () => {
  assert.deepEqual(
    resolveSoilTempPresentation({
      soilTemp6cmCurrentC: 3.8,
      soilTemp6cmSustainedDays: 0,
      thresholdC: 5,
    }),
    {
      label: "SOIL @ 6 CM",
      value: "3.8°C",
      sub: "Below 5°C seed-depth target",
      tone: "info",
    },
  );

  assert.deepEqual(
    resolveSoilTempPresentation({
      soilTemp6cmCurrentC: 7.2,
      soilTemp6cmSustainedDays: 3,
      thresholdC: 5,
    }),
    {
      label: "SOIL @ 6 CM",
      value: "7.2°C",
      sub: "≥5°C for 3d",
      tone: "positive",
    },
  );
});

test("resolveFieldAccessPresentation classifies workable and constrained fields", () => {
  assert.deepEqual(
    resolveFieldAccessPresentation({
      surfaceMoisturePct: 62,
      recentPrecipTotal72hMm: 4,
      freezeThawCycles7d: 1,
    }),
    {
      label: "FIELD ACCESS",
      value: "Workable",
      sub: "Surface 62% · P72h 4mm · 1 thaw cycle",
      tone: "positive",
    },
  );

  assert.deepEqual(
    resolveFieldAccessPresentation({
      surfaceMoisturePct: 88,
      recentPrecipTotal72hMm: 16,
      freezeThawCycles7d: 5,
    }),
    {
      label: "FIELD ACCESS",
      value: "Wait",
      sub: "Surface 88% · P72h 16mm · 5 thaw cycles",
      tone: "danger",
    },
  );
});

test("resolveFieldAccessPresentation respects custom precip and thaw thresholds", () => {
  assert.deepEqual(
    resolveFieldAccessPresentation({
      surfaceMoisturePct: 68,
      recentPrecipTotal72hMm: 8,
      freezeThawCycles7d: 1,
      thresholds: {
        surfaceMoistureMaxPct: 82,
        recentPrecipWarnMm72h: 6,
        recentPrecipBlockMm72h: 12,
        freezeThawWarnCount: 2,
        freezeThawBlockCount: 4,
      },
    }),
    {
      label: "FIELD ACCESS",
      value: "Marginal",
      sub: "Surface 68% · P72h 8mm · 1 thaw cycle",
      tone: "warning",
    },
  );

  assert.deepEqual(
    resolveFieldAccessPresentation({
      surfaceMoisturePct: 71,
      recentPrecipTotal72hMm: 13,
      freezeThawCycles7d: 2,
      thresholds: {
        surfaceMoistureMaxPct: 84,
        recentPrecipWarnMm72h: 6,
        recentPrecipBlockMm72h: 12,
        freezeThawWarnCount: 2,
        freezeThawBlockCount: 4,
      },
    }),
    {
      label: "FIELD ACCESS",
      value: "Wait",
      sub: "Surface 71% · P72h 13mm · 2 thaw cycles",
      tone: "danger",
    },
  );
});

test("resolveSeedingRecommendation returns Too early when soil has not reached the crop threshold", () => {
  const recommendation = resolveSeedingRecommendation({
    cropLabel: "Canola",
    cropStagePresentation: PRESEED_STAGE,
    seedingThresholds: {
      ...STANDARD_SEEDING_THRESHOLDS,
      soilTempMinC: 7,
    },
    frostDamageTempC: -1,
    frostKillTempC: -3,
    soilTemp6cmCurrentC: 4.8,
    soilTemp6cmSustainedDays: 0,
    surfaceMoisturePct: 58,
    fieldAccessPresentation: resolveFieldAccessPresentation({
      surfaceMoisturePct: 58,
      recentPrecipTotal72hMm: 4,
      freezeThawCycles7d: 1,
      thresholds: {
        surfaceMoistureMaxPct: 85,
        recentPrecipWarnMm72h: 10,
        recentPrecipBlockMm72h: 20,
        freezeThawWarnCount: 2,
        freezeThawBlockCount: 4,
      },
    }),
    frostRiskMinTempC7d: 2.5,
    frostRiskNights7d: 0,
    weatherSourceLabel: "open-meteo · hourly-v1",
  });

  assert.equal(recommendation?.title, "Too early to seed");
  assert.equal(recommendation?.urgency, "Watch");
  assert.match(recommendation?.recommendation ?? "", /Hold seeding until canola seed-depth soil temperature reaches 7°C/i);
});

test("resolveSeedingRecommendation returns Hold when frost risk remains in the 7-day window", () => {
  const recommendation = resolveSeedingRecommendation({
    cropLabel: "Wheat",
    cropStagePresentation: PRESEED_STAGE,
    seedingThresholds: STANDARD_SEEDING_THRESHOLDS,
    frostDamageTempC: -2,
    frostKillTempC: -4,
    soilTemp6cmCurrentC: 6.4,
    soilTemp6cmSustainedDays: 3,
    surfaceMoisturePct: 61,
    fieldAccessPresentation: resolveFieldAccessPresentation({
      surfaceMoisturePct: 61,
      recentPrecipTotal72hMm: 4,
      freezeThawCycles7d: 1,
      thresholds: {
        surfaceMoistureMaxPct: 85,
        recentPrecipWarnMm72h: 10,
        recentPrecipBlockMm72h: 20,
        freezeThawWarnCount: 2,
        freezeThawBlockCount: 4,
      },
    }),
    frostRiskMinTempC7d: -2.5,
    frostRiskNights7d: 1,
    weatherSourceLabel: "open-meteo · hourly-v1",
  });

  assert.equal(recommendation?.title, "Hold seeding for frost risk");
  assert.equal(recommendation?.severity, "medium");
  assert.match(recommendation?.whyNow ?? "", /lowest forecast low is -2\.5°C/i);
});

test("resolveSeedingRecommendation returns Seed now when soil, frost, and access align", () => {
  const recommendation = resolveSeedingRecommendation({
    cropLabel: "Peas",
    cropStagePresentation: PRESEED_STAGE,
    seedingThresholds: {
      ...STANDARD_SEEDING_THRESHOLDS,
      soilTempMinC: 4,
    },
    frostDamageTempC: -2,
    frostKillTempC: -4,
    soilTemp6cmCurrentC: 6.2,
    soilTemp6cmSustainedDays: 3,
    surfaceMoisturePct: 62,
    fieldAccessPresentation: resolveFieldAccessPresentation({
      surfaceMoisturePct: 62,
      recentPrecipTotal72hMm: 3,
      freezeThawCycles7d: 1,
      thresholds: {
        surfaceMoistureMaxPct: 85,
        recentPrecipWarnMm72h: 10,
        recentPrecipBlockMm72h: 20,
        freezeThawWarnCount: 2,
        freezeThawBlockCount: 4,
      },
    }),
    frostRiskMinTempC7d: 2.8,
    frostRiskNights7d: 0,
    weatherSourceLabel: "open-meteo · hourly-v1",
  });

  assert.equal(recommendation?.title, "Seeding window open");
  assert.equal(recommendation?.urgency, "Ready");
  assert.match(recommendation?.recommendation ?? "", /Seed now if field checks match this read/i);
});
