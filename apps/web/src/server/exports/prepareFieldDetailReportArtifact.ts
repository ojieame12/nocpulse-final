import { renderPdfDocument, type PdfBlock, type PdfRenderInput, type RGB } from "@fieldpulse/pdf";
import type {
  FieldReportProps,
  ReportChartSection,
  ReportAlertItem,
  ReportFindingItem,
} from "../../components/panels/ReportTab";
import type { FieldActionProps } from "../../components/panels/ActionTab";
import type { FieldSummaryProps } from "../../components/panels/SummaryTab";
import { loadPdfBrandLogo } from "./loadPdfBrandLogo";

/* ═══════════════════════════════════════════════════════════════════
   NocPulse Field Report — Redesigned PDF Builder  (v2)
   ───────────────────────────────────────────────────────────────────
   Produces a polished, farmer-friendly PDF with:

   Page 1  — Cover: field identity, health status, key vitals,
             top-line action items
   Page 2  — Conditions: moisture detail, weather observations,
             derived signals, crop parameter thresholds
   Page 3  — Forecast + Trends: 7-day forecast table, sparkline
             history charts (vegetation, moisture, temperature)
   Page 4  — Alerts & Intelligence: severity cards with plain-
             language actions, tracked zones summary
   Footer  — Data provenance, sources, disclaimer
   ═══════════════════════════════════════════════════════════════════ */

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* ── Brand palette ── */
const GREEN: RGB = [0.08, 0.24, 0.17];
const GREEN_SOFT: RGB = [0.09, 0.64, 0.29];
const RED: RGB = [0.93, 0.27, 0.27];
const AMBER: RGB = [0.96, 0.62, 0.04];
const TEAL: RGB = [0.09, 0.64, 0.29];
const SLATE: RGB = [0.42, 0.44, 0.47];

function sevType(sev: string): "critical" | "warning" | "info" {
  const s = sev.toLowerCase();
  return s === "high" || s === "critical" ? "critical" : s === "med" || s === "medium" || s === "warning" ? "warning" : "info";
}

function hexToRgb(hex: string): RGB | undefined {
  const c = hex.replace("#", "");
  if (c.length !== 6) return undefined;
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  if (Number.isNaN(r)) return undefined;
  return [r, g, b];
}

function chartSparkSeries(chart: ReportChartSection) {
  return chart.series
    .map((series) => ({
      label: series.label,
      color: hexToRgb(series.color) ?? GREEN,
      data: series.points
        .map((point) => point.value)
        .filter((value): value is number => value !== null && Number.isFinite(value)),
    }))
    .filter((series) => series.data.length >= 2);
}

/** Turn a reading value into a display string — never return empty. */
function readingDisplay(value: string): string {
  if (!value || value.trim() === "" || value === "—") return "Not available";
  return value;
}

/** Derive a plain-language action from an alert. */
function alertActionText(alert: ReportAlertItem): string | undefined {
  const text = alert.text.toLowerCase();
  if (text.includes("frost")) return "Consider frost protection measures tonight. Check irrigation lines and row covers.";
  if (text.includes("moisture stress") || text.includes("below the monitor threshold")) return "Schedule irrigation check. Prioritize the affected zones identified below.";
  if (text.includes("hail")) return "Review hail protection options. Check crop insurance coverage.";
  if (text.includes("wind")) return "Assess wind damage risk to standing crop. Delay spraying until conditions settle.";
  if (text.includes("disease")) return "Scout affected areas. Consult agronomist for fungicide options if needed.";
  return undefined;
}

/** Infer a short weather description from temperature and precipitation strings. */
function inferWeatherDesc(temp: string, precip: string): string {
  const tempNums = temp.match(/-?\d+\.?\d*/g);
  const precipNums = precip.match(/\d+\.?\d*/g);
  const minTemp = tempNums && tempNums.length > 0 ? Math.min(...tempNums.map(Number)) : null;
  const precipVal = precipNums && precipNums.length > 0 ? Math.max(...precipNums.map(Number)) : 0;

  if (minTemp !== null && minTemp <= -10) return precipVal >= 2 ? "Snow likely" : "Deep frost";
  if (minTemp !== null && minTemp <= 0) return precipVal >= 2 ? "Rain/snow mix" : "Frost risk";
  if (precipVal >= 10) return "Heavy rain";
  if (precipVal >= 2) return "Light rain";
  if (precipVal > 0) return "Chance of showers";
  return "Dry";
}

/** Generate advisory note for a crop parameter based on its label and position in range. */
function cropParamNote(label: string, value: string, fillPct: number): string {
  const lbl = label.toLowerCase();
  if (fillPct < 25) {
    if (lbl.includes("moisture") && lbl.includes("root")) return "Below optimal. Monitor for wilting and schedule irrigation.";
    if (lbl.includes("moisture") && lbl.includes("surface")) return "Surface is dry. Seed germination risk if planting.";
    if (lbl.includes("frost")) return "Severe frost risk. Protect sensitive tissue overnight.";
    if (lbl.includes("vpd")) return "Very low VPD. Watch for fungal disease pressure.";
    if (lbl.includes("water balance")) return "Negative water balance. Crop drawing down reserves.";
    return "Below expected range for this crop and stage.";
  }
  if (fillPct > 85) {
    if (lbl.includes("moisture")) return "Excess moisture. Check for waterlogging and root rot.";
    if (lbl.includes("vpd")) return "High VPD. Rapid transpiration — increase irrigation.";
    if (lbl.includes("water balance")) return "Surplus water. Drainage may be needed.";
    return "Above expected range. Monitor closely.";
  }
  return "Within acceptable range for selected crop.";
}

function joinParts(parts: Array<string | null | undefined>, separator = " · "): string | undefined {
  const compact = parts.map((part) => part?.trim()).filter((part): part is string => Boolean(part));
  return compact.length > 0 ? compact.join(separator) : undefined;
}

function formatPercent(value: number | null | undefined): string | undefined {
  if (value == null || !Number.isFinite(value)) return undefined;
  return Number.isInteger(value) ? `${value}%` : `${value.toFixed(1)}%`;
}

function dataQualityColor(summary: FieldSummaryProps | null | undefined): RGB {
  switch (summary?.dataQuality?.tone) {
    case "positive":
      return TEAL;
    case "warning":
      return AMBER;
    case "danger":
      return RED;
    default:
      return SLATE;
  }
}

function deriveSummarySource(summary: FieldSummaryProps): string | undefined {
  if (summary.sourceTagExtended?.trim()) return summary.sourceTagExtended.trim();
  if (summary.moistureDerivationMode === "source-backed") {
    return joinParts(["Satellite-derived", summary.confidenceSub !== "No source" ? summary.confidenceSub : undefined]);
  }
  if (summary.moistureDerivationMode && summary.moistureDerivationMode !== "unknown") {
    return joinParts(["Modeled estimate", summary.confidenceSub !== "No source" ? summary.confidenceSub : undefined]);
  }
  return undefined;
}

function actionSeverity(action: FieldActionProps): "critical" | "warning" | "info" {
  if (action.topRiskSeverity) return sevType(action.topRiskSeverity);
  const urgency = action.urgency.toLowerCase();
  if (/(critical|urgent|immediate|high)/.test(urgency)) return "critical";
  if (/(watch|soon|medium|moderate)/.test(urgency)) return "warning";
  return "info";
}

function actionDetail(action: FieldActionProps): string | undefined {
  const due = action.dueDate.trim() ? `Due ${action.dueDate.trim()}` : undefined;
  return joinParts([due, action.intelligenceSourceLabel, action.intelligenceFreshnessLabel]);
}

function actionNextStep(action: FieldActionProps): string | undefined {
  const answeredQuestion = action.questions.find((item) => item.answer?.trim())?.answer?.trim();
  if (answeredQuestion) return answeredQuestion;
  if (action.signals.length > 0) {
    return `Signals to watch: ${action.signals.slice(0, 3).map((signal) => signal.label).join(", ")}.`;
  }
  return undefined;
}

/** Determine row accent color from forecast data. */
function forecastRowColor(temp: string, precip: string): RGB | undefined {
  // Parse lowest temperature from strings like "-3°C / 5°C" or "Low: -2°C"
  const tempNums = temp.match(/-?\d+\.?\d*/g);
  const precipNums = precip.match(/\d+\.?\d*/g);
  if (tempNums && tempNums.length > 0) {
    const minTemp = Math.min(...tempNums.map(Number));
    if (minTemp <= 0) return RED; // Frost risk — red
  }
  if (precipNums && precipNums.length > 0) {
    const precipVal = Math.max(...precipNums.map(Number));
    if (precipVal >= 10) return [0.23, 0.51, 0.85]; // Heavy rain — blue
    if (precipVal >= 2) return [0.40, 0.65, 0.90]; // Light rain — soft blue
  }
  // Check for wind keywords
  if (/wind|gust/i.test(temp) || /wind|gust/i.test(precip)) return AMBER;
  return undefined;
}

/** Derive a plain-language action from a finding. */
function findingActionText(finding: ReportFindingItem): string | undefined {
  const title = finding.title.toLowerCase();
  if (title.includes("frost")) return "Monitor overnight lows. Activate frost mitigation if available.";
  if (title.includes("moisture")) return "Review irrigation scheduling for the upcoming week.";
  if (title.includes("stress")) return "Ground-truth the stressed zones with a field walk in the next 48 hours.";
  return undefined;
}

/* ── Export types ── */

export type PrepareFieldDetailReportArtifactInput = {
  fieldId: string;
  fieldName: string;
  areaLabel: string;
  report: FieldReportProps | null;
  summary: FieldSummaryProps | null;
  action: FieldActionProps | null;
  generatedAt?: string;
};

export type PreparedFieldDetailReportArtifact = {
  bytes: Uint8Array;
  contentType: "application/pdf";
  cacheControl: string;
  fileName: string;
  metadata: {
    artifactKey: string;
    pageCount: number;
    byteSize: number;
    sha256: string;
  };
};

/* ═══════════════════════════════════════════════════════════════════
   Block Builder
   ═══════════════════════════════════════════════════════════════════ */

function buildBlocks(input: PrepareFieldDetailReportArtifactInput): PdfBlock[] {
  const blocks: PdfBlock[] = [];
  const r = input.report;
  const s = input.summary;
  const a = input.action;
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const reportDate = r?.updatedDate ?? generatedAt.slice(0, 10);

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     PAGE 1 — COVER
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

  // Title block
  blocks.push({ kind: "text", style: "title", text: `${input.fieldName}` });
  blocks.push({
    kind: "text",
    style: "subheading",
    text: `Field Report — ${reportDate}`,
  });

  blocks.push({ kind: "spacer", height: 6 });

  // Health status badge
  if (r) {
    const ok = /healthy|good|normal|all clear/i.test(r.healthStatus);
    blocks.push({
      kind: "status-badge",
      label: r.healthStatus,
      color: ok ? TEAL : r.alerts.length > 0 ? RED : AMBER,
      marginTop: 4,
    });
  }

  blocks.push({ kind: "spacer", height: 4 });

  // Field identity — clean 2-column layout
  blocks.push({
    kind: "key-value",
    pairs: [
      { key: "Crop", value: s?.crop ?? "—" },
      { key: "Growth Stage", value: r?.cropStage ?? s?.cropStage ?? "—" },
      { key: "Field Size", value: input.areaLabel },
      { key: "Legal Land", value: r?.lld ?? s?.lld ?? "—" },
    ],
    columns: 2,
    marginTop: 6,
  });

  blocks.push({ kind: "spacer", height: 4 });

  // Quick status strip — the most important numbers at a glance
  if (r) {
    blocks.push({
      kind: "metric-strip",
      cells: [
        { label: "Last Updated", value: reportDate },
        {
          label: "Alerts",
          value: r.alerts.length > 0 ? `${r.alerts.length} Active` : "None",
          valueColor: r.alerts.length > 0 ? RED : TEAL,
        },
        {
          label: "Findings",
          value: r.findings.length > 0 ? `${r.findings.length} Active` : "None",
          valueColor: r.findings.length > 0 ? AMBER : TEAL,
        },
        {
          label: "Zones",
          value: r.zones.length > 0 ? `${r.zones.length} Tracked` : "None",
        },
      ],
      marginTop: 6,
    });
  }

  /* ── Truth & confidence ── */

  if (s && (s.dataQuality || s.confidenceBreakdown || s.sourceTagExtended || s.availableWaterMm || s.depletionPct != null || s.historicalAnomaly || s.dataSources)) {
    const sourceSummary = deriveSummarySource(s);
    const truthPairs = [
      { key: "Data quality", value: s.dataQuality?.label ?? "Unavailable" },
      {
        key: "Confidence",
        value: joinParts([s.confidence, s.confidenceSub && s.confidenceSub !== "No source" ? s.confidenceSub : undefined]) ?? s.confidence,
      },
      ...(sourceSummary ? [{ key: "Moisture source", value: sourceSummary }] : []),
      ...(s.statusLabel ? [{ key: "Water status", value: s.statusLabel }] : []),
      ...(s.availableWaterMm ? [{ key: "Available water", value: s.availableWaterMm }] : []),
      ...(s.depletionPct != null ? [{ key: "Water depletion", value: formatPercent(s.depletionPct) ?? "—" }] : []),
      ...(s.historicalAnomaly?.description ? [{ key: "Historical signal", value: s.historicalAnomaly.description }] : []),
    ];

    blocks.push({ kind: "spacer", height: 6 });
    blocks.push({
      kind: "section-header",
      label: "Data Quality & Confidence",
      meta: s.updatedLabel ?? reportDate,
      accentColor: dataQualityColor(s),
    });

    if (s.dataQuality) {
      blocks.push({
        kind: "status-badge",
        label: `${s.dataQuality.label} Data`,
        color: dataQualityColor(s),
        marginTop: 4,
      });
      blocks.push({
        kind: "text",
        style: "body",
        text: joinParts([s.dataQuality.summary, s.dataQuality.reasons.join(" ")], " ") ?? s.dataQuality.summary,
      });
    }

    blocks.push({
      kind: "key-value",
      pairs: truthPairs,
      columns: 2,
      marginTop: 6,
    });

    if (s.confidenceBreakdown) {
      blocks.push({
        kind: "metric-grid",
        cells: [
          { label: "Freshness", value: s.confidenceBreakdown.freshness },
          { label: "Agreement", value: s.confidenceBreakdown.agreement },
          { label: "Resolution", value: s.confidenceBreakdown.resolution },
          { label: "Scale fit", value: s.confidenceBreakdown.scaleFit },
        ],
        columns: 4,
        marginTop: 6,
      });
    }

    if (s.dataSources) {
      blocks.push({
        kind: "text",
        style: "caption",
        text: `Inputs: Satellite ${s.dataSources.satellite ?? "Unavailable"} · Weather ${s.dataSources.weather ?? "Unavailable"} · Soil ${s.dataSources.soil ?? "Unavailable"}`,
      });
    }
  }

  /* ── Recommended action ── */

  if (a) {
    const recommendationDetail = actionDetail(a);
    const recommendationNextStep = actionNextStep(a);
    const topRiskSummary = joinParts([
      a.topRiskTitle ? `Top risk: ${a.topRiskTitle}` : undefined,
      a.intelligenceSource ? `Intelligence state: ${a.intelligenceSource}` : undefined,
    ]);

    blocks.push({ kind: "spacer", height: 6 });
    blocks.push({
      kind: "section-header",
      label: "Recommended Action",
      meta: a.dueDate,
      accentColor: actionSeverity(a) === "critical" ? RED : actionSeverity(a) === "warning" ? AMBER : GREEN,
    });
    blocks.push({
      kind: "status-badge",
      label: a.urgency,
      color: actionSeverity(a) === "critical" ? RED : actionSeverity(a) === "warning" ? AMBER : TEAL,
      marginTop: 4,
    });
    blocks.push({
      kind: "severity-card",
      severity: actionSeverity(a),
      title: a.recommendation,
      detail: recommendationDetail,
      body: a.explanation,
      action: recommendationNextStep,
      marginTop: 6,
    });
    blocks.push({
      kind: "metric-grid",
      cells: [
        { label: "Confidence", value: a.confidence },
        { label: "Signals", value: String(a.signalCount) },
        { label: "Alerts", value: String(a.activeAlertCount ?? 0) },
        { label: "Findings / Zones", value: `${a.activeFindingCount ?? 0} / ${a.activeZoneCount ?? 0}` },
      ],
      columns: 4,
      marginTop: 6,
    });
    if (topRiskSummary) {
      blocks.push({
        kind: "text",
        style: "caption",
        text: topRiskSummary,
      });
    }
    for (const question of a.questions.slice(0, 2)) {
      if (!question.answer?.trim()) continue;
      blocks.push({
        kind: "text",
        style: "caption",
        text: `${question.question}: ${question.answer.trim()}`,
      });
    }
  }

  /* ── Action Items (farmer-first: what do I need to do?) ── */

  if (r && r.alerts.length > 0) {
    blocks.push({ kind: "spacer", height: 6 });
    blocks.push({
      kind: "section-header",
      label: "Action Required",
      meta: `${r.alerts.length} item${r.alerts.length > 1 ? "s" : ""}`,
      accentColor: RED,
    });

    // Show top 3 alerts as concise severity cards with action language
    for (const alert of r.alerts.slice(0, 3)) {
      const action = alertActionText(alert);
      blocks.push({
        kind: "severity-card",
        severity: sevType(alert.severity),
        title: alert.text,
        detail: alert.detail ?? undefined,
        body: alert.trackedZoneIds.length > 0
          ? `${alert.trackedZoneIds.length} tracked zone${alert.trackedZoneIds.length > 1 ? "s" : ""} linked`
          : undefined,
        action,
        marginTop: 4,
      });
    }
    if (r.alerts.length > 3) {
      blocks.push({
        kind: "text",
        style: "caption",
        text: `+ ${r.alerts.length - 3} more alert${r.alerts.length - 3 > 1 ? "s" : ""} — see Alerts section.`,
      });
    }
  }

  /* ── All 9 Current Readings ── */

  if (r && r.readings.length > 0) {
    blocks.push({ kind: "spacer", height: 8 });
    blocks.push({
      kind: "section-header",
      label: "Current Readings",
      meta: `${r.readings.length} metrics`,
      accentColor: GREEN,
    });

    // First row: primary metrics (up to 5)
    blocks.push({
      kind: "metric-grid",
      cells: r.readings.slice(0, 4).map((rd) => ({
        label: rd.label,
        value: readingDisplay(rd.value),
        valueColor: rd.valueColor ? hexToRgb(rd.valueColor) : undefined,
      })),
      columns: 4,
      marginTop: 6,
    });

    // Second row: remaining metrics
    if (r.readings.length > 4) {
      blocks.push({
        kind: "metric-grid",
        cells: r.readings.slice(4).map((rd) => ({
          label: rd.label,
          value: readingDisplay(rd.value),
          valueColor: rd.valueColor ? hexToRgb(rd.valueColor) : undefined,
        })),
        columns: r.readings.length - 4 <= 3 ? 3 : 4,
        marginTop: 4,
      });
    }
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     PAGE 2 — CONDITIONS & THRESHOLDS
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

  /* ── Moisture Conditions ── */

  if (s) {
    blocks.push({ kind: "spacer", height: 6 });
    blocks.push({
      kind: "section-header",
      label: "Moisture Conditions",
      meta: s.conditionsMeta ?? "Field average",
      accentColor: GREEN,
    });

    blocks.push({
      kind: "metric-grid",
      cells: [
        { label: "Soil Moisture", value: s.rootMoisture, sub: s.rootMoistureSub },
        { label: "Trend (7 days)", value: s.trend, sub: s.trendSub, valueColor: s.trend.startsWith("-") ? AMBER : undefined },
        { label: "Field Variation", value: s.spread, sub: s.spreadSub },
        { label: "Confidence", value: s.confidence, sub: s.confidenceSub },
      ],
      columns: 4,
      marginTop: 6,
    });

    // Moisture depth comparison — Root vs Surface progress bars
    {
      const rootPct = parseFloat(s.rootMoisture) || 0;
      const surfPct = parseFloat(s.surfaceMoisture ?? "0") || 0;
      blocks.push({
        kind: "progress-bar",
        label: "Root Zone Moisture",
        value: s.rootMoisture,
        percent: Math.min(100, rootPct),
        fillColor: rootPct < 25 ? RED : GREEN_SOFT,
        rangeLabels: ["0%", "100%"],
        marginTop: 8,
      });
      blocks.push({
        kind: "progress-bar",
        label: "Surface Moisture",
        value: s.surfaceMoisture ?? "—",
        percent: Math.min(100, surfPct),
        fillColor: surfPct < 20 ? RED : surfPct < 30 ? AMBER : GREEN_SOFT,
        rangeLabels: ["0%", "100%"],
        marginTop: 4,
      });
    }

    blocks.push({ kind: "spacer", height: 8 });

    /* ── Atmosphere ── */

    blocks.push({
      kind: "section-header",
      label: "Weather & Atmosphere",
      accentColor: GREEN,
    });

    blocks.push({
      kind: "metric-grid",
      cells: [
        { label: "Precipitation", value: s.precipitation, sub: s.precipitationSub },
        { label: "Next Rain", value: s.nextRain, sub: s.nextRainSub },
        { label: "Rain Chance", value: s.rainChance, sub: s.rainChanceSub },
        { label: "7-Day Total", value: s.sevenDayTotal, sub: s.sevenDayTotalSub },
      ],
      columns: 4,
      marginTop: 6,
    });
  }

  /* ── Crop Parameter Assessment (table + bars) ── */

  if (r && r.cropParams.length > 0) {
    blocks.push({ kind: "spacer", height: 6 });
    blocks.push({
      kind: "section-header",
      label: "Crop Parameter Assessment",
      meta: r.cropStage || "Stage unverified",
      accentColor: GREEN,
    });

    blocks.push({
      kind: "text",
      style: "caption",
      text: "Each parameter is compared against the acceptable range for this crop and growth stage. Status and advisory notes highlight where attention is needed.",
    });

    // Assessment table — like CAI's Parameter tables with advisory notes
    blocks.push({
      kind: "table",
      columns: [
        { label: "Parameter", width: 0.18 },
        { label: "Current", width: 0.12, align: "right" },
        { label: "Expected Range", width: 0.18 },
        { label: "Status", width: 0.10 },
        { label: "Notes", width: 0.42 },
      ],
      headerBg: GREEN,
      rows: r.cropParams.map((p) => {
        const isLow = p.fillPercent < 25;
        const isHigh = p.fillPercent > 85;
        const status = isLow ? "Below" : isHigh ? "Above" : "In range";
        return {
          cells: [
            p.label,
            p.value,
            `${p.rangeLow} – ${p.rangeHigh}`,
            status,
            cropParamNote(p.label, p.value, p.fillPercent),
          ],
          accentColor: isLow ? RED : isHigh ? AMBER : undefined,
        };
      }),
      marginTop: 6,
    });
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     PAGE 3 — FORECAST + TRENDS
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

  /* ── 7-Day Forecast ── */

  if (r && r.forecast.length > 0) {
    blocks.push({ kind: "spacer", height: 6 });
    blocks.push({
      kind: "section-header",
      label: "7-Day Forecast",
      meta: `${r.forecast.length} days`,
      accentColor: GREEN,
    });

    blocks.push({
      kind: "table",
      columns: [
        { label: "Day", width: 0.22 },
        { label: "Conditions", width: 0.20 },
        { label: "Temperature", width: 0.30 },
        { label: "Precipitation", width: 0.28, align: "right" },
      ],
      headerBg: GREEN,
      rows: r.forecast.map((day) => ({
        cells: [day.day, inferWeatherDesc(day.temp, day.precip), day.temp, day.precip],
        accentColor: forecastRowColor(day.temp, day.precip),
      })),
      marginTop: 6,
    });

    // Precipitation sparkline from forecast data
    const precipValues = r.forecast
      .map((day) => {
        const nums = day.precip.match(/\d+\.?\d*/g);
        return nums ? Math.max(...nums.map(Number)) : 0;
      });
    if (precipValues.some((v) => v > 0)) {
      blocks.push({
        kind: "sparkline",
        label: "Forecast Precipitation (mm)",
        data: precipValues,
        color: [0.23, 0.51, 0.85] as RGB,
        height: 48,
        marginTop: 8,
      });
    }

    // Temperature range sparkline from forecast
    const tempHighValues = r.forecast
      .map((day) => {
        const nums = day.temp.match(/-?\d+\.?\d*/g);
        return nums ? Math.max(...nums.map(Number)) : null;
      })
      .filter((v): v is number => v !== null);
    const tempLowValues = r.forecast
      .map((day) => {
        const nums = day.temp.match(/-?\d+\.?\d*/g);
        return nums ? Math.min(...nums.map(Number)) : null;
      })
      .filter((v): v is number => v !== null);
    if (tempHighValues.length >= 2 && tempLowValues.length >= 2) {
      blocks.push({
        kind: "multi-sparkline",
        label: "Forecast Temperature Window (°C)",
        series: [
          { label: "High", data: tempHighValues, color: RED },
          { label: "Low", data: tempLowValues, color: [0.23, 0.51, 0.85] as RGB },
        ],
        height: 56,
        marginTop: 8,
      });
    }
  }

  /* ── Trend History Sparklines ── */

  if (r && r.charts.length > 0) {
    blocks.push({ kind: "spacer", height: 6 });
    blocks.push({
      kind: "section-header",
      label: "Trend History",
      meta: `${r.charts.length} chart${r.charts.length === 1 ? "" : "s"}`,
      accentColor: GREEN,
    });

    for (const chart of r.charts) {
      const series = chartSparkSeries(chart);
      if (series.length > 0) {
        blocks.push({
          kind: "multi-sparkline",
          label: `${chart.title}  ·  ${chart.subtitle}`,
          series,
          height: 72,
          marginTop: 6,
        });
      } else if (chart.emptyText) {
        blocks.push({
          kind: "text",
          style: "caption",
          text: `${chart.title}: ${chart.emptyText}`,
        });
      }
    }
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     PAGE 4 — ALERTS, FINDINGS & ZONES
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

  /* ── Full Alerts ── */

  const alertCount = r?.alerts.length ?? 0;
  blocks.push({ kind: "spacer", height: 6 });
  blocks.push({
    kind: "section-header",
    label: "Alerts",
    meta: alertCount > 0 ? `${alertCount} active` : "All clear",
    accentColor: alertCount > 0 ? RED : GREEN,
  });

  if (!r || alertCount === 0) {
    blocks.push({
      kind: "text",
      style: "body",
      text: r?.alertsEmptyStateDescription ?? "No active alerts. Field conditions are within expected parameters.",
    });
  } else {
    for (const alert of r.alerts) {
      const action = alertActionText(alert);
      blocks.push({
        kind: "severity-card",
        severity: sevType(alert.severity),
        title: alert.text,
        detail: alert.detail ?? undefined,
        body: alert.trackedZoneIds.length > 0
          ? `${alert.trackedZoneIds.length} tracked zone${alert.trackedZoneIds.length > 1 ? "s" : ""} linked`
          : undefined,
        action,
        marginTop: 6,
      });
    }
  }

  /* ── Intelligence Findings ── */

  if (r && r.findings.length > 0) {
    blocks.push({ kind: "spacer", height: 6 });
    blocks.push({
      kind: "section-header",
      label: "Intelligence Findings",
      meta: `${r.findings.length} active`,
      accentColor: AMBER,
    });

    blocks.push({
      kind: "text",
      style: "caption",
      text: "NocPulse intelligence combines satellite imagery, weather data, and crop models to surface potential issues before they become visible in the field.",
    });

    for (const f of r.findings) {
      const action = findingActionText(f);
      blocks.push({
        kind: "severity-card",
        severity: sevType(f.severity),
        title: f.title,
        body: f.summary ?? undefined,
        action,
        marginTop: 6,
      });
    }
  }

  /* ── Tracked Zones ── */

  if (r && r.zones.length > 0) {
    blocks.push({ kind: "spacer", height: 6 });
    blocks.push({
      kind: "section-header",
      label: "Tracked Zones",
      meta: `${r.zones.length} zone${r.zones.length > 1 ? "s" : ""}`,
      accentColor: GREEN,
    });

    blocks.push({
      kind: "text",
      style: "caption",
      text: "Zones are groups of field cells that share a common stress pattern. NocPulse tracks their evolution over time.",
    });

    blocks.push({
      kind: "table",
      columns: [
        { label: "Type", width: 0.24 },
        { label: "Status", width: 0.16 },
        { label: "Severity", width: 0.16 },
        { label: "Cells", width: 0.14, align: "right" },
        { label: "Last Observed", width: 0.30 },
      ],
      headerBg: GREEN,
      rows: r.zones.slice(0, 12).map((z) => ({
        cells: [
          z.family.replace(/_/g, " "),
          z.status,
          z.severity ?? "—",
          String(z.affectedCellCount),
          z.lastSeenAt,
        ],
        accentColor:
          z.severity === "High" ? RED
            : z.severity === "Med" ? AMBER
              : undefined,
      })),
      marginTop: 6,
    });

    if (r.zones.length > 12) {
      blocks.push({
        kind: "text",
        style: "caption",
        text: `+ ${r.zones.length - 12} additional zone${r.zones.length - 12 > 1 ? "s" : ""} not shown.`,
      });
    }
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     FOOTER — PROVENANCE & SOURCES
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

  blocks.push({ kind: "spacer", height: 8 });
  blocks.push({ kind: "divider", marginTop: 8, color: SLATE, thickness: 0.5 });

  blocks.push({
    kind: "section-header",
    label: "Data Sources & Provenance",
    accentColor: GREEN,
    marginTop: 6,
  });

  if (r) {
    blocks.push({ kind: "text", style: "caption", text: r.provenanceText });
    if (r.sources.length > 0) {
      blocks.push({
        kind: "text",
        style: "caption",
        text: `Data sources: ${r.sources.map((src) => src.label).join("  ·  ")}`,
      });
    }
  }

  blocks.push({ kind: "spacer", height: 4 });
  blocks.push({
    kind: "text",
    style: "caption",
    text: "This report was generated by NocPulse and reflects conditions at the time of data collection. Always verify critical decisions with on-ground observation. Report data may be delayed; check the platform for the latest readings.",
  });

  return blocks;
}

/* ═══════════════════════════════════════════════════════════════════
   Public API
   ═══════════════════════════════════════════════════════════════════ */

export function prepareFieldDetailReportArtifact(
  input: PrepareFieldDetailReportArtifactInput,
): PreparedFieldDetailReportArtifact {
  const blocks = buildBlocks(input);
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const now = generatedAt.slice(0, 10);
  const brandLogo = loadPdfBrandLogo();

  const renderInput: PdfRenderInput = {
    artifactKey: `detail-reports/${slugify(input.fieldName)}/${now}.pdf`,
    title: `Field Report: ${input.fieldName}`,
    subject: `NocPulse field report for ${input.fieldName} — ${now}`,
    author: "NocPulse",
    brandLogo: brandLogo ? { format: "png", bytes: brandLogo } : undefined,
    blocks,
  };

  const result = renderPdfDocument(renderInput);
  const fileName = `${slugify(input.fieldName)}-field-report-${now}.pdf`;

  return {
    bytes: result.bytes,
    contentType: "application/pdf",
    cacheControl: "private, max-age=0, no-cache",
    fileName,
    metadata: result.metadata,
  };
}
