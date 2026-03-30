import test from "node:test";
import assert from "node:assert/strict";

import {
  parseNumericValue,
  hasDisplayValue,
  percentile,
  titleCaseLabel,
  formatSignedMetricDelta,
  buildSparkFromSurface,
  splitMetricDisplayParts,
  resolveSurfaceForMode,
  findContextTile,
  findReportReading,
  findReportChart,
  findLatestReportChartPointValue,
  buildSparkFromReportChart,
  buildSparkFromReportChartSeries,
  resolveReportChartRangeLabels,
  resolveModeTrendChart,
  findCropFieldTile,
  findCropProvenanceValue,
  isPreseasonOpticalContextSurface,
} from "../fieldDetailHelpers";

test("parseNumericValue: extracts integer from string", () => {
  assert.equal(parseNumericValue("42%"), 42);
});

test("parseNumericValue: extracts decimal", () => {
  assert.equal(parseNumericValue("42.5%"), 42.5);
});

test("parseNumericValue: extracts negative number", () => {
  assert.equal(parseNumericValue("-3.2mm"), -3.2);
});

test("parseNumericValue: returns null for null", () => {
  assert.equal(parseNumericValue(null), null);
});

test("parseNumericValue: returns null for undefined", () => {
  assert.equal(parseNumericValue(undefined), null);
});

test("parseNumericValue: returns null for empty string", () => {
  assert.equal(parseNumericValue(""), null);
});

test("parseNumericValue: returns null for '—' (em dash, no digits)", () => {
  assert.equal(parseNumericValue("—"), null);
});

test("parseNumericValue: returns null for 'no data' (no digits)", () => {
  assert.equal(parseNumericValue("no data"), null);
});

test("parseNumericValue: extracts first numeric from mixed string", () => {
  assert.equal(parseNumericValue("about 12.5 things"), 12.5);
});

test("parseNumericValue: returns 0 for '0%'", () => {
  assert.equal(parseNumericValue("0%"), 0);
});

test("hasDisplayValue: null -> false", () => {
  assert.equal(hasDisplayValue(null), false);
});

test("hasDisplayValue: undefined -> false", () => {
  assert.equal(hasDisplayValue(undefined), false);
});

test("hasDisplayValue: empty string -> false", () => {
  assert.equal(hasDisplayValue(""), false);
});

test("hasDisplayValue: whitespace-only -> false", () => {
  assert.equal(hasDisplayValue("   "), false);
});

test("hasDisplayValue: '—' -> false", () => {
  assert.equal(hasDisplayValue("—"), false);
});

test("hasDisplayValue: 'no data' -> false (case-insensitive)", () => {
  assert.equal(hasDisplayValue("no data"), false);
  assert.equal(hasDisplayValue("No Data"), false);
  assert.equal(hasDisplayValue("NO DATA"), false);
});

test("hasDisplayValue: '0' -> true", () => {
  assert.equal(hasDisplayValue("0"), true);
});

test("hasDisplayValue: '42.5%' -> true", () => {
  assert.equal(hasDisplayValue("42.5%"), true);
});

test("hasDisplayValue: 'Healthy' -> true", () => {
  assert.equal(hasDisplayValue("Healthy"), true);
});

test("percentile: empty array -> null", () => {
  assert.equal(percentile([], 0.5), null);
});

test("percentile: single element -> that element regardless of fraction", () => {
  assert.equal(percentile([42], 0.0), 42);
  assert.equal(percentile([42], 0.5), 42);
  assert.equal(percentile([42], 1.0), 42);
});

test("percentile: [10, 20, 30] at fraction=0.5 -> 20", () => {
  assert.equal(percentile([10, 20, 30], 0.5), 20);
});

test("percentile: [10, 20, 30] at fraction=0.0 -> 10", () => {
  assert.equal(percentile([10, 20, 30], 0.0), 10);
});

test("percentile: [10, 20, 30] at fraction=1.0 -> 30", () => {
  assert.equal(percentile([10, 20, 30], 1.0), 30);
});

test("percentile: interpolates between adjacent values", () => {
  assert.equal(percentile([10, 20], 0.5), 15);
});

test("percentile: clamps negative fraction to 0", () => {
  assert.equal(percentile([10, 20, 30], -0.5), 10);
});

test("percentile: clamps fraction > 1 to 1", () => {
  assert.equal(percentile([10, 20, 30], 1.5), 30);
});

test("titleCaseLabel: null -> '—'", () => {
  assert.equal(titleCaseLabel(null), "—");
});

test("titleCaseLabel: undefined -> '—'", () => {
  assert.equal(titleCaseLabel(undefined), "—");
});

test("titleCaseLabel: empty string -> '—'", () => {
  assert.equal(titleCaseLabel(""), "—");
});

test("titleCaseLabel: 'moisture' -> 'Moisture'", () => {
  assert.equal(titleCaseLabel("moisture"), "Moisture");
});

test("titleCaseLabel: already capitalized -> unchanged", () => {
  assert.equal(titleCaseLabel("Healthy"), "Healthy");
});

test("titleCaseLabel: single char -> capitalized", () => {
  assert.equal(titleCaseLabel("a"), "A");
});

test("formatSignedMetricDelta: null -> '—'", () => {
  assert.equal(formatSignedMetricDelta("ndvi", null), "—");
});

test("buildSparkFromSurface: null -> [0,0,0,0,0,0]", () => {
  assert.deepEqual(buildSparkFromSurface(null), [0, 0, 0, 0, 0, 0]);
});

test("buildSparkFromSurface: empty cells -> [0,0,0,0,0,0]", () => {
  assert.deepEqual(buildSparkFromSurface({ cells: [], metricAveragePct: 50 } as any), [0, 0, 0, 0, 0, 0]);
});

test("buildSparkFromSurface: always returns 6 elements", () => {
  const surface = {
    cells: [{ metricValuePct: 20 }, { metricValuePct: 40 }, { metricValuePct: 60 }, { metricValuePct: 80 }],
    metricAveragePct: 50,
  } as any;
  const result = buildSparkFromSurface(surface);
  assert.equal(result.length, 6);
});

test("buildSparkFromSurface: result is monotonically non-decreasing", () => {
  const surface = {
    cells: Array.from({ length: 20 }, (_, i) => ({ metricValuePct: i * 5 })),
    metricAveragePct: 47.5,
  } as any;
  const result = buildSparkFromSurface(surface);
  for (let i = 1; i < result.length; i++) {
    assert.ok(result[i]! >= result[i - 1]!, `result[${i}] (${result[i]}) < result[${i - 1}] (${result[i - 1]})`);
  }
});

test("splitMetricDisplayParts: null pct -> display='—', unit=''", () => {
  const result = splitMetricDisplayParts("ndvi", null);
  assert.equal(result.display, "—");
  assert.equal(result.unit, "");
});

test("splitMetricDisplayParts: returns object with display and unit keys", () => {
  const result = splitMetricDisplayParts("root-zone-moisture-pct", 50);
  assert.ok("display" in result);
  assert.ok("unit" in result);
});

test("findContextTile: null market -> null", () => {
  assert.equal(findContextTile(null, "ROOT MOISTURE"), null);
});

test("findContextTile: missing label -> null", () => {
  const market = { contextTiles: [{ label: "YIELD", value: "42" }] } as any;
  assert.equal(findContextTile(market, "NONEXISTENT"), null);
});

test("findContextTile: matching label -> returns tile", () => {
  const tile = { label: "ROOT MOISTURE", value: "38%" };
  const market = { contextTiles: [tile] } as any;
  assert.deepEqual(findContextTile(market, "ROOT MOISTURE"), tile);
});

test("findReportReading: null report -> null", () => {
  assert.equal(findReportReading(null, "temperature"), null);
});

test("findReportChart: null report -> null", () => {
  assert.equal(findReportChart(null, 0), null);
});

test("findReportChart: out of bounds index -> null", () => {
  const report = { charts: [{ title: "Chart 0" }] } as any;
  assert.equal(findReportChart(report, 5), null);
});

test("findLatestReportChartPointValue: null chart -> null", () => {
  assert.equal(findLatestReportChartPointValue(null), null);
});

test("findLatestReportChartPointValue: walks backwards to find last finite value", () => {
  const chart = {
    series: [{ points: [{ value: 10 }, { value: 20 }, { value: null }, { value: 30 }] }],
  } as any;
  assert.equal(findLatestReportChartPointValue(chart), 30);
});

test("findLatestReportChartPointValue: all-null points -> null", () => {
  const chart = { series: [{ points: [{ value: null }, { value: undefined }] }] } as any;
  assert.equal(findLatestReportChartPointValue(chart), null);
});

test("buildSparkFromReportChart: null chart -> [0]", () => {
  assert.deepEqual(buildSparkFromReportChart(null), [0]);
});

test("buildSparkFromReportChart: filters out null values, returns finite values", () => {
  const chart = {
    series: [{ points: [{ value: 10 }, { value: null }, { value: 30 }] }],
  } as any;
  assert.deepEqual(buildSparkFromReportChart(chart), [10, 30]);
});

test("buildSparkFromReportChartSeries: null series -> [0]", () => {
  assert.deepEqual(buildSparkFromReportChartSeries(null), [0]);
});

test("buildSparkFromReportChartSeries: undefined series -> [0]", () => {
  assert.deepEqual(buildSparkFromReportChartSeries(undefined), [0]);
});

test("resolveReportChartRangeLabels: null chart -> { start: 'Start', end: 'Latest' }", () => {
  const result = resolveReportChartRangeLabels(null);
  assert.equal(result.start, "Start");
  assert.equal(result.end, "Latest");
});

test("resolveReportChartRangeLabels: uses first and last point labels", () => {
  const chart = {
    series: [{ points: [{ label: "Jan 1" }, { label: "Jan 15" }, { label: "Feb 1" }] }],
  } as any;
  const result = resolveReportChartRangeLabels(chart);
  assert.equal(result.start, "Jan 1");
  assert.equal(result.end, "Feb 1");
});

test("resolveModeTrendChart: null report -> both null", () => {
  const result = resolveModeTrendChart(null, "moisture");
  assert.equal(result.chart, null);
  assert.equal(result.series, null);
});

test("resolveModeTrendChart: moisture mode uses chart index 1", () => {
  const report = {
    charts: [
      { title: "Vegetation", series: [{ label: "NDVI" }] },
      { title: "Moisture", series: [{ label: "Root Zone" }] },
    ],
  } as any;
  const result = resolveModeTrendChart(report, "moisture");
  assert.equal(result.chart?.title, "Moisture");
  assert.equal(result.series?.label, "Root Zone");
});

test("resolveModeTrendChart: ndvi mode uses chart index 0, series 0", () => {
  const report = {
    charts: [
      { title: "Vegetation", series: [{ label: "NDVI" }, { label: "NDRE" }] },
      { title: "Moisture", series: [{ label: "Root Zone" }] },
    ],
  } as any;
  const result = resolveModeTrendChart(report, "ndvi");
  assert.equal(result.chart?.title, "Vegetation");
  assert.equal(result.series?.label, "NDVI");
});

test("resolveModeTrendChart: ndre mode uses chart index 0, series 1", () => {
  const report = {
    charts: [
      { title: "Vegetation", series: [{ label: "NDVI" }, { label: "NDRE" }] },
      { title: "Moisture", series: [] },
    ],
  } as any;
  const result = resolveModeTrendChart(report, "ndre");
  assert.equal(result.series?.label, "NDRE");
});

test("resolveModeTrendChart: ndmi mode returns chart[1] but series=null", () => {
  const report = {
    charts: [
      { title: "Vegetation", series: [] },
      { title: "Moisture", series: [{ label: "Root Zone" }] },
    ],
  } as any;
  const result = resolveModeTrendChart(report, "ndmi");
  assert.equal(result.chart?.title, "Moisture");
  assert.equal(result.series, null);
});

test("resolveModeTrendChart: radarWetness prefers series[2], falls back to series[0]", () => {
  const report = {
    charts: [
      { title: "Vegetation", series: [] },
      { title: "Moisture", series: [{ label: "Root Zone" }, { label: "Surface" }] },
    ],
  } as any;
  const result = resolveModeTrendChart(report, "radarWetness");
  assert.equal(result.series?.label, "Root Zone");
});

test("findCropFieldTile: null -> null", () => {
  assert.equal(findCropFieldTile(null, "Soil Temp"), null);
});

test("findCropProvenanceValue: null -> null", () => {
  assert.equal(findCropProvenanceValue(null, "Seed Lot"), null);
});

test("findCropProvenanceValue: finds matching key", () => {
  const crop = { provenanceRows: [{ key: "Seed Lot", value: "ABC-123" }] } as any;
  assert.equal(findCropProvenanceValue(crop, "Seed Lot"), "ABC-123");
});

test("findCropProvenanceValue: missing key -> null", () => {
  const crop = { provenanceRows: [{ key: "Seed Lot", value: "ABC-123" }] } as any;
  assert.equal(findCropProvenanceValue(crop, "Variety"), null);
});

test("resolveSurfaceForMode: null mapModel -> null", () => {
  assert.equal(resolveSurfaceForMode(null, "moisture"), null);
});

test("resolveSurfaceForMode: undefined mapModel -> null", () => {
  assert.equal(resolveSurfaceForMode(undefined, "moisture"), null);
});

test("isPreseasonOpticalContextSurface: null -> false", () => {
  assert.equal(isPreseasonOpticalContextSurface(null), false);
});

test("isPreseasonOpticalContextSurface: undefined -> false", () => {
  assert.equal(isPreseasonOpticalContextSurface(undefined), false);
});

test("isPreseasonOpticalContextSurface: matching label -> true", () => {
  assert.equal(isPreseasonOpticalContextSurface({ sourceLabel: "preseason-optical-context-v1" } as any), true);
});

test("isPreseasonOpticalContextSurface: non-matching label -> false", () => {
  assert.equal(
    isPreseasonOpticalContextSurface({ sourceLabel: "sentinel-hub-stats-v1:sentinel-2" } as any),
    false,
  );
});
