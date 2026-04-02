import test from "node:test";
import assert from "node:assert/strict";
import { resolveCropRuleContext } from "./resolveCropRuleContext";
import { prairieDefaultRulePack } from "../domain/rulePacks/prairieDefaultRulePack";

test("resolveCropRuleContext falls back to the generic crop profile when no crop context is provided", () => {
  const result = resolveCropRuleContext({
    rulePack: prairieDefaultRulePack,
  });

  assert.equal(result.crop.cropKey, "generic");
  assert.equal(result.crop.cropLabel, "Generic prairie crop");
  assert.equal(result.crop.growthStage, "vegetative");
  assert.equal(result.crop.isGenericCrop, true);
  assert.equal(result.crop.isDefaultStage, true);
  assert.equal(result.crop.gddBaseC, 5);
  assert.equal(result.moistureStress.rootZoneMonitorPct, 28);
  assert.equal(result.weatherRisk.frost.damageTempC, -2);
  assert.equal(result.seedingThresholds.soilTempMinC, 5);
  assert.equal(result.seedingThresholds.sustainedDays, 3);
  assert.deepEqual(
    result.diseaseRisk.models.map((model) => model.key),
    ["generic-wet-canopy"],
  );
});

test("resolveCropRuleContext normalizes crop aliases and applies crop-specific stage overrides", () => {
  const result = resolveCropRuleContext({
    rulePack: prairieDefaultRulePack,
    cropContext: {
      cropType: "MAIZE",
      growthStage: "veg",
    },
  });

  assert.equal(result.crop.cropKey, "corn");
  assert.equal(result.crop.normalizedCropType, "maize");
  assert.equal(result.crop.growthStage, "vegetative");
  assert.equal(result.crop.isGenericCrop, false);
  assert.equal(result.crop.isDefaultStage, false);
  assert.equal(result.crop.gddBaseC, 10);
  assert.equal(result.weatherRisk.frost.damageTempC, 0);
  assert.equal(result.weatherRisk.frost.killTempC, -1.5);
  assert.equal(result.seedingThresholds.soilTempMinC, 10);
  assert.equal(result.seedingThresholds.sustainedDays, 5);
  assert.equal(
    result.weatherRisk.atmosphericDemand.elevatedVpdKpa,
    prairieDefaultRulePack.weatherRisk.atmosphericDemand.elevatedVpdKpa,
  );
  assert.deepEqual(
    result.diseaseRisk.models.map((model) => model.key),
    ["generic-wet-canopy"],
  );
});

test("resolveCropRuleContext filters disease models to the crop and stage when a crop-specific match exists", () => {
  const result = resolveCropRuleContext({
    rulePack: prairieDefaultRulePack,
    cropContext: {
      cropType: "spring wheat",
      growthStage: "flowering",
    },
  });

  assert.equal(result.crop.cropKey, "wheat");
  assert.equal(result.crop.growthStage, "flowering");
  assert.equal(result.moistureStress.rootZoneMonitorPct, 29);
  assert.equal(result.moistureStress.rootZoneCriticalPct, 23);
  assert.equal(result.seedingThresholds.soilTempMinC, 5);
  assert.deepEqual(
    result.diseaseRisk.models.map((model) => model.key),
    ["wheat-fhb"],
  );
});

test("resolveCropRuleContext keeps stage-specific generic disease models when no crop-specific model exists", () => {
  const result = resolveCropRuleContext({
    rulePack: prairieDefaultRulePack,
    cropContext: {
      cropType: "flax",
      growthStage: "flowering",
    },
  });

  assert.equal(result.crop.cropKey, "flax");
  assert.equal(result.crop.growthStage, "flowering");
  assert.equal(result.moistureStress.rootZoneMonitorPct, 27);
  assert.equal(result.moistureStress.rootZoneCriticalPct, 21);
  assert.deepEqual(
    result.diseaseRisk.models.map((model) => model.key),
    ["generic-wet-canopy"],
  );
});

test("resolveCropRuleContext normalizes alternate stage names and keeps crop-specific atmospheric demand overrides", () => {
  const result = resolveCropRuleContext({
    rulePack: prairieDefaultRulePack,
    cropContext: {
      cropType: "lentil",
      growthStage: "reproductive",
    },
  });

  assert.equal(result.crop.cropKey, "lentils");
  assert.equal(result.crop.growthStage, "flowering");
  assert.equal(result.weatherRisk.atmosphericDemand.elevatedVpdKpa, 1.3);
  assert.equal(result.weatherRisk.atmosphericDemand.severeVpdKpa, 1.7);
  assert.equal(result.weatherRisk.atmosphericDemand.monitorWaterBalance24hMm, -2);
  assert.deepEqual(
    result.diseaseRisk.models.map((model) => model.key),
    ["pulse-ascochyta"],
  );
});
