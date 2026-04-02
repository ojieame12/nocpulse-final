import assert from "node:assert/strict";
import test from "node:test";
import {
  isSpringSeedingContext,
  resolveFieldAccessPresentation,
  resolveSoilTempPresentation,
} from "./buildFieldOverviewViewModel.spring";

test("isSpringSeedingContext detects early or unverified crop stages", () => {
  assert.equal(
    isSpringSeedingContext({
      displayStageLabel: "Pre Seed",
      ruleStage: "pre-seed",
      thresholdStageLabel: "Pre Seed stage",
      accumulatedGddLabel: "—",
      gddUnitLabel: "Season heat units unavailable (base 5°C)",
      stageSourceLabel: "Weather-derived stage still initializing",
      hasCredibleAccumulatedGdd: false,
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
