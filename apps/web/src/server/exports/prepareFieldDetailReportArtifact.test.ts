import assert from "node:assert/strict";
import test from "node:test";
import { prepareFieldDetailReportArtifact } from "./prepareFieldDetailReportArtifact";
import type { FieldReportProps } from "../../components/panels/ReportTab";
import type { FieldSummaryProps } from "../../components/panels/SummaryTab";

test("prepareFieldDetailReportArtifact renders a branded field report PDF artifact", () => {
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
    generatedAt: "2026-03-30T07:30:00.000Z",
  });

  assert.equal(prepared.contentType, "application/pdf");
  assert.match(prepared.fileName, /krants-field-report-2026-03-30\.pdf$/);

  const pdfText = Buffer.from(prepared.bytes).toString("utf8");
  assert.match(pdfText, /^%PDF-1\.4/);
  assert.match(pdfText, /NocPulse/);
  assert.match(pdfText, /Krants Field Report/);
  assert.match(pdfText, /CURRENT READINGS/);
  assert.match(pdfText, /VEGETATION HISTORY/);
  assert.match(pdfText, /NDVI/);
  assert.match(pdfText, /NDRE/);
  assert.match(pdfText, /7-DAY FORECAST/);
  assert.match(pdfText, /ACTIVE ALERTS/);
  assert.match(pdfText, /TRACKED ZONES/);
  assert.match(pdfText, /PROVENANCE/);
  assert.match(pdfText, /\/Subtype \/Image/);
});
