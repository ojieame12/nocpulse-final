import test from "node:test";
import assert from "node:assert/strict";

import { buildFieldDetailModeData } from "../fieldDetailModeDataBuilder";
import type { ModeKey } from "../fieldDetailTypes";

function createMinimalInput(overrides: Record<string, unknown> = {}) {
  return {
    mode: "moisture" as ModeKey,
    mapModel: null,
    hoveredCell: null,
    summary: null,
    report: null,
    crop: null,
    action: null,
    market: null,
    ...overrides,
  };
}

function createSurfaceMapModel(opts: {
  metricKey?: string;
  cellCount?: number;
  metricValuePct?: number;
  metricAveragePct?: number;
  sourceLabel?: string;
} = {}) {
  const {
    metricKey = "root-zone-moisture-pct",
    cellCount = 10,
    metricValuePct = 50,
    metricAveragePct = 50,
    sourceLabel = "sentinel-hub-stats-v1:sentinel-1",
  } = opts;
  const cells = Array.from({ length: cellCount }, (_, i) => ({
    metricValuePct: metricValuePct + (i - cellCount / 2),
    severityLabel: "healthy" as const,
    anomalyClass: "near-field" as const,
    deltaFromFieldAvgPct: i - cellCount / 2,
    percentileInField: i / cellCount,
    zoneId: null,
    varianceBucket: "low" as const,
  }));
  return {
    agronomicSurface: {
      metricKey,
      cells,
      metricAveragePct,
      sourceLabel,
      confidence: "high",
    },
    alternateAgronomicSurfaces: {},
  };
}

test("shape: output always has hero, headline, sub, vitals, spark, spatialColumns, interpretation, risk", () => {
  const result = buildFieldDetailModeData(createMinimalInput());
  assert.ok("hero" in result);
  assert.ok("headline" in result);
  assert.ok("sub" in result);
  assert.ok("vitals" in result);
  assert.ok("spark" in result);
  assert.ok("spatialColumns" in result);
  assert.ok("interpretation" in result);
  assert.ok("risk" in result);
  assert.ok("riskLevel" in result);
  assert.ok("sourceSummary" in result);
});

test("shape: hero has v (number), d (string), u (string), sev (SeverityKey)", () => {
  const result = buildFieldDetailModeData(createMinimalInput());
  assert.equal(typeof result.hero.v, "number");
  assert.equal(typeof result.hero.d, "string");
  assert.equal(typeof result.hero.u, "string");
  assert.ok(["positive", "warning", "danger"].includes(result.hero.sev));
});

test("shape: vitals is a non-empty array of objects with label and value", () => {
  const result = buildFieldDetailModeData(createMinimalInput());
  assert.ok(Array.isArray(result.vitals));
  assert.ok(result.vitals.length > 0);
  for (const vital of result.vitals) {
    assert.ok("label" in vital);
    assert.ok("value" in vital);
  }
});

test("shape: spatialColumns is always exactly 3 elements", () => {
  const result = buildFieldDetailModeData(createMinimalInput());
  assert.equal(result.spatialColumns.length, 3);
  for (const col of result.spatialColumns) {
    assert.ok("label" in col);
    assert.ok("value" in col);
  }
});

test("shape: hero.v is clamped between 0 and 1", () => {
  const result = buildFieldDetailModeData(createMinimalInput());
  assert.ok(result.hero.v >= 0);
  assert.ok(result.hero.v <= 1);
});

test("null surface: hero.d is '—', hero.v is 0, hero.sev is 'warning'", () => {
  const result = buildFieldDetailModeData(createMinimalInput({ mapModel: null }));
  assert.equal(result.hero.d, "—");
  assert.equal(result.hero.v, 0);
  assert.equal(result.hero.sev, "warning");
});

test("null surface: headline ends with 'unavailable'", () => {
  const result = buildFieldDetailModeData(createMinimalInput({ mapModel: null }));
  assert.ok(result.headline.endsWith("unavailable"));
});

test("null surface: spark is [0,0,0,0,0,0]", () => {
  const result = buildFieldDetailModeData(createMinimalInput({ mapModel: null }));
  assert.deepEqual(result.spark, [0, 0, 0, 0, 0, 0]);
});

test("null surface: spatialColumns all have value '—'", () => {
  const result = buildFieldDetailModeData(createMinimalInput({ mapModel: null }));
  for (const col of result.spatialColumns) {
    assert.equal(col.value, "—");
  }
});

test("null surface: riskLevel is 'Unavailable'", () => {
  const result = buildFieldDetailModeData(createMinimalInput({ mapModel: null }));
  assert.equal(result.riskLevel, "Unavailable");
});

test("all modes: null surface produces valid output for every mode", () => {
  const modes: ModeKey[] = ["moisture", "ndvi", "ndre", "ndmi", "radarWetness"];
  for (const mode of modes) {
    const result = buildFieldDetailModeData(createMinimalInput({ mode }));
    assert.ok(result.hero);
    assert.ok(result.headline.length > 0);
    assert.equal(result.hero.d, "—");
  }
});

test("different modes produce different headlines with a surface present", () => {
  const mapModel = createSurfaceMapModel();
  const moistureResult = buildFieldDetailModeData(createMinimalInput({ mode: "moisture", mapModel }));

  const ndviMapModel = {
    agronomicSurface: {
      ...mapModel.agronomicSurface,
      metricKey: "ndvi",
    },
    alternateAgronomicSurfaces: {},
  };
  const ndviResult = buildFieldDetailModeData(createMinimalInput({ mode: "ndvi", mapModel: ndviMapModel }));

  assert.notEqual(moistureResult.headline, ndviResult.headline);
});

test("moisture mode vitals include 'Surface' label", () => {
  const mapModel = createSurfaceMapModel();
  const result = buildFieldDetailModeData(createMinimalInput({ mode: "moisture", mapModel }));
  const labels = result.vitals.map((v) => v.label);
  assert.ok(labels.includes("Surface"));
});

test("ndvi mode vitals include 'Crop Health' label", () => {
  const mapModel = createSurfaceMapModel({ metricKey: "ndvi" });
  const result = buildFieldDetailModeData(createMinimalInput({ mode: "ndvi", mapModel }));
  const labels = result.vitals.map((v) => v.label);
  assert.ok(labels.includes("Crop Health"));
});

test("ndre mode vitals include 'Canopy Vigor' label", () => {
  const mapModel = createSurfaceMapModel({ metricKey: "ndre" });
  const result = buildFieldDetailModeData(createMinimalInput({ mode: "ndre", mapModel }));
  const labels = result.vitals.map((v) => v.label);
  assert.ok(labels.includes("Canopy Vigor"));
});

test("severity: all-healthy cells (0% stressed) -> hero.sev is 'positive'", () => {
  const mapModel = createSurfaceMapModel({ cellCount: 20, metricValuePct: 50 });
  const result = buildFieldDetailModeData(createMinimalInput({ mode: "moisture", mapModel }));
  assert.equal(result.hero.sev, "positive");
});

test("severity: null surface -> hero.sev is 'warning'", () => {
  const result = buildFieldDetailModeData(createMinimalInput());
  assert.equal(result.hero.sev, "warning");
});

test("preseason context: contextOnly is true, riskLevel is 'Context Only'", () => {
  const mapModel = createSurfaceMapModel({
    metricKey: "ndvi",
    sourceLabel: "preseason-optical-context-v2",
  });
  const result = buildFieldDetailModeData(createMinimalInput({ mode: "ndvi", mapModel }));
  assert.equal(result.contextOnly, true);
  assert.equal(result.riskLevel, "Context Only");
});

test("preseason context: ndvi mode changes headline to preseason messaging", () => {
  const mapModel = createSurfaceMapModel({
    metricKey: "ndvi",
    sourceLabel: "preseason-optical-context-v2",
  });
  const result = buildFieldDetailModeData(createMinimalInput({ mode: "ndvi", mapModel }));
  assert.ok(result.headline.toLowerCase().includes("preseason"));
});

test("hover: hoveredCell with matching metricKey overrides headline to include 'cell'", () => {
  const mapModel = createSurfaceMapModel();
  const hoveredCell = {
    metricKey: "root-zone-moisture-pct",
    metricValuePct: 35,
    severityLabel: "stressed",
    anomalyClass: "cold-spot",
    deltaFromFieldAvgPct: -15,
    percentileInField: 0.12,
    sourceTier: "primary",
    zoneId: null,
    varianceBucket: "high",
  };
  const result = buildFieldDetailModeData(createMinimalInput({ mode: "moisture", mapModel, hoveredCell }));
  assert.ok(result.headline.toLowerCase().includes("cell"));
});

test("hover: hoveredCell overrides vitals to show Delta, Percentile, Anomaly", () => {
  const mapModel = createSurfaceMapModel();
  const hoveredCell = {
    metricKey: "root-zone-moisture-pct",
    metricValuePct: 35,
    severityLabel: "stressed",
    anomalyClass: "cold-spot",
    deltaFromFieldAvgPct: -15,
    percentileInField: 0.12,
    sourceTier: "primary",
    zoneId: null,
    varianceBucket: "high",
  };
  const result = buildFieldDetailModeData(createMinimalInput({ mode: "moisture", mapModel, hoveredCell }));
  const labels = result.vitals.map((v) => v.label);
  assert.ok(labels.includes("Delta"));
  assert.ok(labels.includes("Percentile"));
  assert.ok(labels.includes("Anomaly"));
});

test("hover: non-matching metricKey does NOT override vitals", () => {
  const mapModel = createSurfaceMapModel();
  const hoveredCell = {
    metricKey: "ndvi",
    metricValuePct: 35,
    severityLabel: "healthy",
    anomalyClass: "near-field",
    deltaFromFieldAvgPct: 0,
    percentileInField: 0.5,
    sourceTier: "primary",
    zoneId: null,
    varianceBucket: "low",
  };
  const result = buildFieldDetailModeData(createMinimalInput({ mode: "moisture", mapModel, hoveredCell }));
  const labels = result.vitals.map((v) => v.label);
  assert.ok(!labels.includes("Delta"));
});

test("action urgency: non-Routine urgency overrides derived riskLevel", () => {
  const mapModel = createSurfaceMapModel();
  const action = { urgency: "Urgent", recommendation: "Apply fungicide now" };
  const result = buildFieldDetailModeData(createMinimalInput({ mode: "moisture", mapModel, action }));
  assert.equal(result.riskLevel, "Urgent");
});

test("action urgency: 'Routine' does not override derived riskLevel", () => {
  const mapModel = createSurfaceMapModel();
  const action = { urgency: "Routine", recommendation: "Continue monitoring" };
  const result = buildFieldDetailModeData(createMinimalInput({ mode: "moisture", mapModel, action }));
  assert.notEqual(result.riskLevel, "Routine");
});

test("spark: with no report, spark comes from surface (6 elements)", () => {
  const mapModel = createSurfaceMapModel({ cellCount: 20 });
  const result = buildFieldDetailModeData(createMinimalInput({ mode: "moisture", mapModel }));
  assert.equal(result.spark.length, 6);
});

test("spark: with report trend chart, spark length matches chart point count", () => {
  const mapModel = createSurfaceMapModel();
  const report = {
    charts: [
      { title: "Vegetation", series: [], subtitle: "" },
      {
        title: "Moisture Trend",
        subtitle: "14-day",
        series: [{
          label: "Root Zone",
          color: "#3b82f6",
          points: [
            { label: "Mar 15", value: 42 },
            { label: "Mar 18", value: 38 },
            { label: "Mar 21", value: 45 },
            { label: "Mar 24", value: 41 },
          ],
        }],
      },
    ],
    findings: [],
    zones: [],
    readings: [],
  } as any;
  const result = buildFieldDetailModeData(createMinimalInput({ mode: "moisture", mapModel, report }));
  assert.equal(result.spark.length, 4);
});
