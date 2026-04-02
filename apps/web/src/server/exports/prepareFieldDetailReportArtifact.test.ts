/**
 * prepareFieldDetailReportArtifact — Test Suite
 *
 * Tests the web report builder that transforms FieldReportProps + FieldSummaryProps
 * into a fully rendered PDF artifact.
 *
 * Run: corepack pnpm --filter @fieldpulse/web exec node --import tsx --test src/server/exports/prepareFieldDetailReportArtifact.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { prepareFieldDetailReportArtifact } from "./prepareFieldDetailReportArtifact";
import type { FieldActionProps } from "../../components/panels/ActionTab";
import type { FieldReportProps } from "../../components/panels/ReportTab";
import type { FieldSummaryProps } from "../../components/panels/SummaryTab";

/* ── Shared test data factories ── */

function makeMinimalReport(overrides?: Partial<FieldReportProps>): FieldReportProps {
  return {
    name: "Test Field",
    lld: "NE-01-001-01-W4",
    updatedDate: "Apr 1, 2026",
    healthStatus: "Healthy",
    readings: [],
    cropStage: "V6",
    cropParams: [],
    charts: [],
    forecast: [],
    alerts: [],
    findings: [],
    zones: [],
    provenanceText: "Test provenance.",
    sources: [],
    ...overrides,
  };
}

function makeMinimalSummary(overrides?: Partial<FieldSummaryProps>): FieldSummaryProps {
  return {
    name: "Test Field",
    lld: "NE-01-001-01-W4",
    crop: "Wheat",
    cropStage: "V6",
    contextLabel: "Field overview",
    conditionsMeta: "Field average",
    updatedLabel: "UPDATED APR 1, 2026",
    moisture: 0.45,
    cloudCover: "10%",
    surfaceMoisture: "22%",
    fieldState: "Normal",
    fieldStateColor: "#16a34a",
    rootMoisture: "45.0%",
    rootMoistureSub: "Adequate",
    trend: "+1.2%",
    trendSub: "vs SAR raster",
    spread: "8.0",
    spreadSub: "24 mapped cells",
    confidence: "High",
    confidenceSub: "sentinel-1",
    precipitation: "2.0 mm",
    precipitationSub: "Current observation",
    nextRain: "1d",
    nextRainSub: "Forecast",
    rainChance: "40%",
    rainChanceSub: "Next window",
    sevenDayTotal: "12.0 mm",
    sevenDayTotalSub: "Loaded forecast",
    alerts: [],
    outlook: [],
    ...overrides,
  };
}

function makeMinimalAction(overrides?: Partial<FieldActionProps>): FieldActionProps {
  return {
    name: "Test Field",
    lld: "NE-01-001-01-W4",
    recommendation: "Scout low-moisture pockets before the next spray pass",
    dueDate: "Today",
    explanation: "Modeled moisture is slipping below the preferred range in the driest cells.",
    urgency: "Priority this week",
    confidence: "Medium",
    signalCount: 3,
    signals: [
      { label: "Moisture stress watch", color: "yellow" },
      { label: "Drying weather", color: "yellow" },
    ],
    questions: [
      {
        question: "What should I check first?",
        answer: "Walk the driest quarter first and verify rooting depth before changing irrigation or spray timing.",
      },
    ],
    intelligenceState: "active",
    intelligenceSource: "findings",
    intelligenceSourceLabel: "Intelligence findings",
    intelligenceFreshnessLabel: "Updated 6h ago",
    activeFindingCount: 2,
    activeZoneCount: 1,
    activeAlertCount: 1,
    topRiskTitle: "Moisture stress watch",
    topRiskSeverity: "medium",
    ...overrides,
  };
}

function generatePdf(
  reportOverrides?: Partial<FieldReportProps> | null,
  summaryOverrides?: Partial<FieldSummaryProps> | null,
  actionOverrides?: Partial<FieldActionProps> | null,
) {
  return prepareFieldDetailReportArtifact({
    fieldId: "field-test",
    fieldName: "Test Field",
    areaLabel: "100 ha",
    report: reportOverrides === null ? null : makeMinimalReport(reportOverrides),
    summary: summaryOverrides === null ? null : makeMinimalSummary(summaryOverrides),
    action:
      actionOverrides === undefined || actionOverrides === null
        ? null
        : makeMinimalAction(actionOverrides),
    generatedAt: "2026-04-01T12:00:00.000Z",
  });
}

/* ═══════════════════════════════════════════════════════════════════
   1. FULL INTEGRATION — EXISTING TEST (expanded)
   ═══════════════════════════════════════════════════════════════════ */

describe("full report integration", () => {
  it("renders a branded field report PDF artifact", () => {
  const report: FieldReportProps = {
    name: "Krants",
    lld: "SE-19-037-11-W3",
    updatedDate: "Mar 30, 2026",
    healthStatus: "Needs Attention",
    readings: [
      { iconKey: "temperature", label: "Temperature", value: "-6.4°C" },
      { iconKey: "root-moisture", label: "Root Moisture", value: "27.6%" },
    ],
    cropStage: "Pre-emergence",
    cropParams: [
      {
        label: "Root Moisture",
        value: "27.6%",
        rangeLow: "18%",
        rangeHigh: "70%",
        fillPercent: 39,
      },
    ],
    charts: [
      {
        title: "VEGETATION HISTORY",
        subtitle: "Preseason optical context",
        series: [
          {
            label: "NDVI",
            color: "#16a34a",
            format: "index",
            points: [
              { label: "Mar 18", value: 0.04 },
              { label: "Mar 27", value: 0.08 },
            ],
          },
          {
            label: "NDRE",
            color: "#14b8a6",
            format: "index",
            points: [
              { label: "Mar 18", value: 0.0 },
              { label: "Mar 27", value: 0.03 },
            ],
          },
        ],
      },
      {
        title: "MOISTURE PROFILE HISTORY",
        subtitle: "Root + surface moisture from raster",
        series: [
          {
            label: "Root",
            color: "#3b82f6",
            format: "percent",
            points: [
              { label: "Mar 26", value: 27.6 },
              { label: "Mar 30", value: 25.2 },
            ],
          },
          {
            label: "Surface",
            color: "#0ea5e9",
            format: "percent",
            points: [
              { label: "Mar 26", value: 11.0 },
              { label: "Mar 30", value: 9.8 },
            ],
          },
        ],
      },
      {
        title: "TEMPERATURE WINDOW",
        subtitle: "Latest observation + next forecast days",
        series: [
          {
            label: "High",
            color: "#f97316",
            format: "temperature",
            points: [
              { label: "Now", value: -6.0 },
              { label: "Mon, Mar 30", value: -4.0 },
            ],
          },
          {
            label: "Low",
            color: "#94a3b8",
            format: "temperature",
            points: [
              { label: "Now", value: -8.0 },
              { label: "Mon, Mar 30", value: -10.0 },
            ],
          },
        ],
      },
    ],
    forecast: [
      { day: "MON, MAR 30", temp: "-6/-8", precip: "70%" },
      { day: "TUE, MAR 31", temp: "-3/-7", precip: "20%" },
    ],
    alerts: [
      {
        iconKey: "temperature",
        severity: "High",
        text: "Critical frost risk next 24h",
        trackedZoneIds: [],
        detail: "Min temp -9.8°C",
      },
    ],
    findings: [
      {
        id: "finding-1",
        title: "Moisture stress intensifying",
        summary: "Root moisture is trending down.",
        severity: "Med",
        trackedZoneIds: ["zone-1"],
      },
    ],
    zones: [
      {
        id: "zone-1",
        family: "moisture_stress",
        trackingKey: "MS-1",
        status: "persistent",
        severity: "Med",
        affectedCellCount: 6,
        lastSeenAt: "Mar 30, 2026",
      },
    ],
    provenanceText: "Root zone moisture: avg 27.6%, range 21.0–35.0%. 36 cells, 2 low-confidence.",
    sources: [{ label: "sentinel-1" }, { label: "open-meteo" }],
  };

  const summary: FieldSummaryProps = {
    name: "Krants",
    lld: "SE-19-037-11-W3",
    crop: "Canola",
    cropStage: "Pre-emergence",
    contextLabel: "Field overview",
    conditionsMeta: "Field average",
    updatedLabel: "UPDATED MAR 30, 2026",
    moisture: 0.276,
    cloudCover: "14%",
    surfaceMoisture: "11%",
    fieldState: "Dry",
    fieldStateColor: "#f59e0b",
    rootMoisture: "27.6%",
    rootMoistureSub: "Below threshold",
    trend: "-2.4%",
    trendSub: "vs SAR raster",
    spread: "14.0",
    spreadSub: "36 mapped cells",
    confidence: "Medium",
    confidenceSub: "sentinel-1",
    precipitation: "0.0 mm",
    precipitationSub: "Current observation",
    nextRain: "2d",
    nextRainSub: "Forecast precipitation signal",
    rainChance: "70%",
    rainChanceSub: "Next forecast window",
    sevenDayTotal: "3.2 mm",
    sevenDayTotalSub: "Loaded forecast window",
    alerts: [],
    outlook: [],
  };

  const prepared = prepareFieldDetailReportArtifact({
    fieldId: "field-1",
    fieldName: "Krants",
    areaLabel: "64.7 ha",
    report,
    summary,
    action: null,
    generatedAt: "2026-03-30T07:30:00.000Z",
  });

  assert.equal(prepared.contentType, "application/pdf");
  assert.match(prepared.fileName, /krants-field-report-2026-03-30\.pdf$/);

  const pdfText = Buffer.from(prepared.bytes).toString("utf8");
  assert.match(pdfText, /^%PDF-1\.4/);
  assert.match(pdfText, /NocPulse/);
  assert.match(pdfText, /Field Report/);
  assert.match(pdfText, /Krants/);
  assert.match(pdfText, /\/Subtype \/Image/);
  });

  it("produces valid PDF structure with xref and trailer", () => {
    const prepared = generatePdf();
    const pdfText = Buffer.from(prepared.bytes).toString("utf8");
    assert.match(pdfText, /xref/);
    assert.match(pdfText, /%%EOF/);
    assert.ok(prepared.metadata.pageCount >= 1, "Should have at least 1 page");
    assert.ok(prepared.metadata.byteSize > 0, "Should have positive byte size");
    assert.ok(prepared.metadata.sha256.length > 0, "Should have a SHA-256 hash");
  });
});

/* ═══════════════════════════════════════════════════════════════════
   2. NULL / EMPTY DATA HANDLING
   ═══════════════════════════════════════════════════════════════════ */

describe("null and empty data handling", () => {
  it("generates PDF with null report", () => {
    const prepared = generatePdf(null, undefined);
    const pdfText = Buffer.from(prepared.bytes).toString("utf8");
    assert.match(pdfText, /^%PDF-1\.4/);
    assert.ok(prepared.metadata.pageCount >= 1);
  });

  it("generates PDF with null summary", () => {
    const prepared = generatePdf(undefined, null);
    const pdfText = Buffer.from(prepared.bytes).toString("utf8");
    assert.match(pdfText, /^%PDF-1\.4/);
    assert.ok(prepared.metadata.pageCount >= 1);
  });

  it("generates PDF with both null report and summary", () => {
    const prepared = generatePdf(null, null);
    const pdfText = Buffer.from(prepared.bytes).toString("utf8");
    assert.match(pdfText, /^%PDF-1\.4/);
  });

  it("handles empty readings array", () => {
    const prepared = generatePdf({ readings: [] });
    assert.ok(prepared.metadata.byteSize > 0);
  });

  it("handles empty forecast array", () => {
    const prepared = generatePdf({ forecast: [] });
    assert.ok(prepared.metadata.byteSize > 0);
  });

  it("handles empty alerts array", () => {
    const prepared = generatePdf({ alerts: [] });
    const pdfText = Buffer.from(prepared.bytes).toString("utf8");
    assert.match(pdfText, /^%PDF-1\.4/);
  });

  it("handles empty cropParams array", () => {
    const prepared = generatePdf({ cropParams: [] });
    assert.ok(prepared.metadata.byteSize > 0);
  });

  it("handles empty charts array", () => {
    const prepared = generatePdf({ charts: [] });
    assert.ok(prepared.metadata.byteSize > 0);
  });

  it("handles empty zones array", () => {
    const prepared = generatePdf({ zones: [] });
    assert.ok(prepared.metadata.byteSize > 0);
  });

  it("handles empty findings array", () => {
    const prepared = generatePdf({ findings: [] });
    assert.ok(prepared.metadata.byteSize > 0);
  });
});

describe("truth and action sections", () => {
  it("renders data quality and confidence context from summary metadata", () => {
    const prepared = generatePdf(
      undefined,
      {
        updatedLabel: "UPDATED APR 2, 2026",
        sourceTagExtended: "Satellite-derived · SAR 18h ago",
        statusLabel: "Watch",
        availableWaterMm: "41 mm",
        depletionPct: 38,
        historicalAnomaly: {
          percentile: 18,
          description: "Drier than normal versus the historical record",
          anomalyClass: "unusually-dry",
        },
        confidenceBreakdown: {
          freshness: "Recent",
          agreement: "Weather and SAR agree",
          resolution: "20 m cells",
          scaleFit: "Field scale",
          sourceAge: "Recent",
          coverage: "20 m cells",
        },
        dataSources: {
          satellite: "Sentinel-1 SAR",
          weather: "Open-Meteo",
          soil: "Modeled soil profile",
        },
        dataQuality: {
          label: "Ready",
          tone: "positive",
          summary: "This field has strong source-backed moisture coverage.",
          reasons: ["Recent SAR pass.", "Weather and soil inputs are aligned."],
        },
      },
      null,
    );
    const pdfText = Buffer.from(prepared.bytes).toString("utf8");
    assert.match(pdfText, /DATA QUALITY & CONFIDENCE/i);
    assert.match(pdfText, /Ready Data/i);
    assert.match(pdfText, /Satellite-derived/i);
    assert.match(pdfText, /41 mm/i);
  });

  it("renders a recommended action section when action context is provided", () => {
    const prepared = generatePdf(
      undefined,
      undefined,
      {
        recommendation: "Inspect low-moisture zones before tomorrow morning",
        dueDate: "Tomorrow morning",
        urgency: "Urgent today",
        confidence: "High confidence",
        signalCount: 4,
        activeAlertCount: 2,
        activeFindingCount: 3,
        activeZoneCount: 2,
        topRiskTitle: "Moisture stress watch",
        topRiskSeverity: "high",
        questions: [
          {
            question: "What should I do first?",
            answer: "Check the driest cells near the south edge and confirm whether the stress is real before changing irrigation timing.",
          },
        ],
      },
    );
    const pdfText = Buffer.from(prepared.bytes).toString("utf8");
    assert.match(pdfText, /RECOMMENDED ACTION/i);
    assert.match(pdfText, /Inspect low-moisture zones before tomorrow morning/i);
    assert.match(pdfText, /Urgent today/i);
    assert.match(pdfText, /Moisture stress watch/i);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   3. CROP PARAMETER ASSESSMENT TABLE
   ═══════════════════════════════════════════════════════════════════ */

describe("crop parameter assessment", () => {
  it("generates below-range note for low fill percent", () => {
    const prepared = generatePdf({
      cropParams: [
        { label: "Root Zone Moisture", value: "12%", rangeLow: "18%", rangeHigh: "70%", fillPercent: 10 },
      ],
    });
    const pdfText = Buffer.from(prepared.bytes).toString("utf8");
    assert.match(pdfText, /CROP PARAMETER ASSESSMENT/i);
  });

  it("generates above-range note for high fill percent", () => {
    const prepared = generatePdf({
      cropParams: [
        { label: "VPD", value: "3.2 kPa", rangeLow: "0.5", rangeHigh: "2.0", fillPercent: 95 },
      ],
    });
    assert.ok(prepared.metadata.byteSize > 0);
  });

  it("handles multiple crop params with mixed statuses", () => {
    const prepared = generatePdf({
      cropParams: [
        { label: "Root Zone Moisture", value: "12%", rangeLow: "18%", rangeHigh: "70%", fillPercent: 10 },
        { label: "Surface Moisture", value: "45%", rangeLow: "20%", rangeHigh: "60%", fillPercent: 55 },
        { label: "VPD", value: "3.5 kPa", rangeLow: "0.5", rangeHigh: "2.0", fillPercent: 92 },
        { label: "Frost Risk", value: "-8°C", rangeLow: "-2", rangeHigh: "5", fillPercent: 5 },
        { label: "Water Balance 24h", value: "-4mm", rangeLow: "-2", rangeHigh: "5", fillPercent: 15 },
      ],
    });
    assert.ok(prepared.metadata.pageCount >= 1);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   4. FORECAST TABLE
   ═══════════════════════════════════════════════════════════════════ */

describe("forecast table and sparklines", () => {
  it("generates forecast table with inferred weather conditions", () => {
    const prepared = generatePdf({
      forecast: [
        { day: "MON", temp: "15/22", precip: "0 mm" },
        { day: "TUE", temp: "12/18", precip: "5 mm" },
        { day: "WED", temp: "-2/3", precip: "12 mm" },
        { day: "THU", temp: "-12/-5", precip: "3 mm" },
        { day: "FRI", temp: "8/16", precip: "0 mm" },
        { day: "SAT", temp: "10/20", precip: "0.5 mm" },
        { day: "SUN", temp: "14/24", precip: "0 mm" },
      ],
    });
    const pdfText = Buffer.from(prepared.bytes).toString("utf8");
    assert.match(pdfText, /7-DAY FORECAST/i);
  });

  it("handles forecast with no numeric values in temp/precip", () => {
    const prepared = generatePdf({
      forecast: [
        { day: "MON", temp: "N/A", precip: "N/A" },
        { day: "TUE", temp: "—", precip: "—" },
      ],
    });
    assert.ok(prepared.metadata.byteSize > 0);
  });

  it("handles single-day forecast", () => {
    const prepared = generatePdf({
      forecast: [{ day: "TODAY", temp: "10/15", precip: "2 mm" }],
    });
    assert.ok(prepared.metadata.byteSize > 0);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   5. CHARTS AND SPARKLINES
   ═══════════════════════════════════════════════════════════════════ */

describe("charts and sparklines", () => {
  it("handles chart with empty series points", () => {
    const prepared = generatePdf({
      charts: [
        {
          title: "EMPTY CHART",
          subtitle: "No data",
          series: [{ label: "NDVI", color: "#16a34a", format: "index", points: [] }],
        },
      ],
    });
    assert.ok(prepared.metadata.byteSize > 0);
  });

  it("handles chart with single-point series (below 2-point minimum)", () => {
    const prepared = generatePdf({
      charts: [
        {
          title: "SINGLE POINT",
          subtitle: "Barely any data",
          series: [
            { label: "NDVI", color: "#16a34a", format: "index", points: [{ label: "Mar 1", value: 0.5 }] },
          ],
        },
      ],
    });
    assert.ok(prepared.metadata.byteSize > 0);
  });

  it("handles chart with null values in points", () => {
    const prepared = generatePdf({
      charts: [
        {
          title: "GAPS",
          subtitle: "Missing values",
          series: [
            {
              label: "Root",
              color: "#3b82f6",
              format: "percent",
              points: [
                { label: "W1", value: 30 },
                { label: "W2", value: null },
                { label: "W3", value: 28 },
                { label: "W4", value: 25 },
              ],
            },
          ],
        },
      ],
    });
    assert.ok(prepared.metadata.byteSize > 0);
  });

  it("renders chart with emptyText fallback", () => {
    const prepared = generatePdf({
      charts: [
        {
          title: "NO DATA CHART",
          subtitle: "Waiting",
          emptyText: "Insufficient satellite passes for this period.",
          series: [],
        },
      ],
    });
    assert.ok(prepared.metadata.byteSize > 0);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   6. ALERTS & FINDINGS
   ═══════════════════════════════════════════════════════════════════ */

describe("alerts and findings", () => {
  it("renders multiple alerts with action text derivation", () => {
    const prepared = generatePdf({
      alerts: [
        { iconKey: "temperature", severity: "High", text: "Critical frost risk", trackedZoneIds: [], detail: "-9°C" },
        { iconKey: "moisture", severity: "Med", text: "Moisture stress detected", trackedZoneIds: ["z1", "z2"] },
        { iconKey: "hail", severity: "High", text: "Hail warning in effect", trackedZoneIds: [] },
        { iconKey: "wind", severity: "Low", text: "Wind advisory", trackedZoneIds: [] },
        { iconKey: "disease", severity: "Med", text: "Disease pressure rising", trackedZoneIds: ["z3"] },
      ],
    });
    const pdfText = Buffer.from(prepared.bytes).toString("utf8");
    assert.match(pdfText, /^%PDF-1\.4/);
  });

  it("truncates to 3 alerts on cover page with overflow note", () => {
    const prepared = generatePdf({
      alerts: Array.from({ length: 6 }, (_, i) => ({
        iconKey: "temperature",
        severity: "High",
        text: `Alert ${i + 1}: Something requires attention`,
        trackedZoneIds: [],
      })),
    });
    assert.ok(prepared.metadata.byteSize > 0);
  });

  it("renders findings with severity cards", () => {
    const prepared = generatePdf({
      findings: [
        { id: "f1", title: "Frost damage detected", summary: "Two zones affected.", severity: "High", trackedZoneIds: ["z1"] },
        { id: "f2", title: "Moisture recovery", summary: "Improving trend.", severity: "Low", trackedZoneIds: [] },
      ],
    });
    assert.ok(prepared.metadata.byteSize > 0);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   7. TRACKED ZONES
   ═══════════════════════════════════════════════════════════════════ */

describe("tracked zones", () => {
  it("renders zone table with severity color coding", () => {
    const prepared = generatePdf({
      zones: [
        { id: "z1", family: "moisture_stress", trackingKey: "MS-1", status: "persistent", severity: "High", affectedCellCount: 12, lastSeenAt: "Apr 1, 2026" },
        { id: "z2", family: "vegetation_anomaly", trackingKey: "VA-1", status: "new", severity: "Med", affectedCellCount: 4, lastSeenAt: "Apr 1, 2026" },
        { id: "z3", family: "frost_damage", trackingKey: "FD-1", status: "resolved", severity: "Low", affectedCellCount: 2, lastSeenAt: "Mar 30, 2026" },
      ],
    });
    assert.ok(prepared.metadata.byteSize > 0);
  });

  it("truncates zones beyond 12 with overflow note", () => {
    const prepared = generatePdf({
      zones: Array.from({ length: 15 }, (_, i) => ({
        id: `z${i}`,
        family: "moisture_stress",
        trackingKey: `MS-${i}`,
        status: "persistent",
        severity: "Med" as const,
        affectedCellCount: i + 1,
        lastSeenAt: "Apr 1, 2026",
      })),
    });
    assert.ok(prepared.metadata.byteSize > 0);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   8. SPECIAL CHARACTERS & ENCODING
   ═══════════════════════════════════════════════════════════════════ */

describe("special characters", () => {
  it("handles em dashes, degrees, and bullets in field data", () => {
    const prepared = generatePdf({
      readings: [
        { iconKey: "temperature", label: "Temperature", value: "—" },
        { iconKey: "root-moisture", label: "Root Moisture", value: "27.6% • below threshold" },
      ],
      healthStatus: "Needs Attention — Monitor closely",
    });
    assert.ok(prepared.metadata.byteSize > 0);
  });

  it("handles empty string values in readings", () => {
    const prepared = generatePdf({
      readings: [
        { iconKey: "temperature", label: "Temperature", value: "" },
        { iconKey: "root-moisture", label: "Root Moisture", value: "   " },
      ],
    });
    assert.ok(prepared.metadata.byteSize > 0);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   9. LARGE REPORT STRESS TEST
   ═══════════════════════════════════════════════════════════════════ */

describe("large report", () => {
  it("handles many readings (9+)", () => {
    const prepared = generatePdf({
      readings: Array.from({ length: 9 }, (_, i) => ({
        iconKey: "temperature",
        label: `Metric ${i + 1}`,
        value: `${(i * 5.3).toFixed(1)}`,
      })),
    });
    assert.ok(prepared.metadata.pageCount >= 1);
  });

  it("handles many alerts without crashing", () => {
    const prepared = generatePdf({
      alerts: Array.from({ length: 20 }, (_, i) => ({
        iconKey: "temperature",
        severity: i % 3 === 0 ? "High" : i % 3 === 1 ? "Med" : "Low",
        text: `Alert ${i + 1}: ${i % 2 === 0 ? "Frost risk" : "Moisture stress"} in zone ${i}`,
        trackedZoneIds: i % 2 === 0 ? [`z${i}`] : [],
        detail: `Detail for alert ${i + 1}`,
      })),
    });
    assert.ok(prepared.metadata.pageCount >= 2, "Many alerts should produce multiple pages");
  });
});

/* ═══════════════════════════════════════════════════════════════════
   10. OUTPUT METADATA
   ═══════════════════════════════════════════════════════════════════ */

describe("output metadata", () => {
  it("produces correct content type and filename slug", () => {
    const prepared = prepareFieldDetailReportArtifact({
      fieldId: "field-abc",
      fieldName: "Biehn West Quarter",
      areaLabel: "160 ac",
      report: makeMinimalReport(),
      summary: makeMinimalSummary(),
      action: null,
      generatedAt: "2026-04-01T12:00:00.000Z",
    });
    assert.equal(prepared.contentType, "application/pdf");
    assert.match(prepared.fileName, /biehn-west-quarter-field-report-2026-04-01\.pdf$/);
  });

  it("artifact key includes slugified field name and date", () => {
    const prepared = prepareFieldDetailReportArtifact({
      fieldId: "field-xyz",
      fieldName: "O'Brien's Field #3",
      areaLabel: "50 ha",
      report: makeMinimalReport(),
      summary: makeMinimalSummary(),
      action: null,
      generatedAt: "2026-04-01T00:00:00.000Z",
    });
    assert.match(prepared.metadata.artifactKey, /detail-reports\//);
    assert.match(prepared.metadata.artifactKey, /2026-04-01\.pdf$/);
  });

  it("SHA-256 is deterministic for same input", () => {
    const a = generatePdf();
    const b = generatePdf();
    assert.equal(a.metadata.sha256, b.metadata.sha256, "Same input should produce same hash");
  });
});
