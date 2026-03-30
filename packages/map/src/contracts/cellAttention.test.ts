import test from "node:test";
import assert from "node:assert/strict";
import {
  describeCellAttentionLevel,
  resolveCellAttentionLevel,
} from "./cellAttention";

test("field-typical optical cells are softened even when the absolute severity is stressed", () => {
  const level = resolveCellAttentionLevel({
    metricKey: "ndvi",
    severityLabel: "stressed",
    anomalyClass: "near-field",
    deltaFromFieldAvgPct: 2.1,
    percentileInField: 52,
  });

  assert.equal(level, "stable");
  assert.equal(describeCellAttentionLevel(level), "Field Typical");
});

test("localized optical outliers can still escalate to critical attention", () => {
  const level = resolveCellAttentionLevel({
    metricKey: "ndre",
    severityLabel: "critical",
    anomalyClass: "below-field",
    deltaFromFieldAvgPct: -14.2,
    percentileInField: 2,
  });

  assert.equal(level, "critical");
  assert.equal(describeCellAttentionLevel(level), "Localized Critical");
});

test("moisture metrics stay more absolute than optical metrics", () => {
  const level = resolveCellAttentionLevel({
    metricKey: "root-zone-moisture-pct",
    severityLabel: "critical",
    anomalyClass: "near-field",
    deltaFromFieldAvgPct: -1.2,
    percentileInField: 49,
  });

  assert.equal(level, "watch");
});
