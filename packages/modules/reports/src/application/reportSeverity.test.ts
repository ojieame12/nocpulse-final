import assert from "node:assert/strict";
import test from "node:test";
import {
  inferCropAlertSeverity,
  inferCropDiseaseRiskSeverity,
  normalizeReportSeverity,
} from "./reportSeverity";

test("normalizeReportSeverity maps field severities to report severities", () => {
  assert.equal(normalizeReportSeverity("high"), "critical");
  assert.equal(normalizeReportSeverity("critical"), "critical");
  assert.equal(normalizeReportSeverity("medium"), "warning");
  assert.equal(normalizeReportSeverity("warning"), "warning");
  assert.equal(normalizeReportSeverity("low"), "info");
  assert.equal(normalizeReportSeverity(undefined), "info");
});

test("inferCropDiseaseRiskSeverity maps compact percent bands", () => {
  assert.equal(inferCropDiseaseRiskSeverity("62%"), "critical");
  assert.equal(inferCropDiseaseRiskSeverity("30%"), "warning");
  assert.equal(inferCropDiseaseRiskSeverity("12%"), "info");
  assert.equal(inferCropDiseaseRiskSeverity("n/a"), "info");
});

test("inferCropAlertSeverity maps compact icon families", () => {
  assert.equal(inferCropAlertSeverity("disease"), "critical");
  assert.equal(inferCropAlertSeverity("temperature"), "critical");
  assert.equal(inferCropAlertSeverity("moisture"), "warning");
  assert.equal(inferCropAlertSeverity("general"), "info");
});
