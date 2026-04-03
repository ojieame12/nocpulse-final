import assert from "node:assert/strict";
import test from "node:test";
import {
  inferCropAlertFollowUpAction,
  inferDiseaseRiskFollowUpAction,
  inferFieldAlertFollowUpAction,
  inferFieldFindingFollowUpAction,
} from "./inferReportFollowUpAction";

test("inferFieldAlertFollowUpAction preserves explicit recommended actions", () => {
  assert.equal(
    inferFieldAlertFollowUpAction({
      title: "Wind advisory",
      summary: null,
      recommendedAction: "Use existing playbook.",
    }),
    "Use existing playbook.",
  );
});

test("inferFieldAlertFollowUpAction returns compact frost guidance", () => {
  assert.equal(
    inferFieldAlertFollowUpAction({
      title: "Frost warning",
      summary: "Overnight risk building",
      recommendedAction: null,
    }),
    "Check frost protection measures. Monitor overnight low temperatures closely.",
  );
});

test("inferFieldFindingFollowUpAction returns compact stress guidance", () => {
  assert.equal(
    inferFieldFindingFollowUpAction({
      title: "Localized stress cluster",
      summary: "Stress signature expanding",
      recommendedAction: null,
    }),
    "Ground-truth stressed zones within the next 48 hours.",
  );
});

test("inferCropAlertFollowUpAction returns compact atmospheric-demand guidance", () => {
  assert.equal(
    inferCropAlertFollowUpAction("Atmospheric demand elevated"),
    "Monitor crop water demand. Consider irrigation timing.",
  );
});

test("inferDiseaseRiskFollowUpAction returns compact crop-disease guidance", () => {
  assert.equal(
    inferDiseaseRiskFollowUpAction("Sclerotinia", "warning"),
    "Scout canopy for sclerotinia symptoms. Consult agronomist on fungicide timing if at petal stage.",
  );
  assert.equal(
    inferDiseaseRiskFollowUpAction("Unknown disease pressure", "critical"),
    "Scout affected areas immediately. Consult agronomist for treatment options.",
  );
  assert.equal(
    inferDiseaseRiskFollowUpAction("Sclerotinia", "info"),
    undefined,
  );
});
