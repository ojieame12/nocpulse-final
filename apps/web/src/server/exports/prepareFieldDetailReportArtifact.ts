import { renderPdfDocument, type PdfBlock, type PdfRenderInput, type RGB } from "@fieldpulse/pdf";
import type {
  FieldReportProps,
  ReportChartSection,
} from "../../components/panels/ReportTab";
import type { FieldSummaryProps } from "../../components/panels/SummaryTab";
import { loadPdfBrandLogo } from "./loadPdfBrandLogo";

/* ═══════════════════════════════════════════════════════════════════
   Field Detail Report — Branded PDF Artifact
   ───────────────────────────────────────────────────────────────────
   Produces a visual NocPulse-branded PDF from the same view-model
   data that drives the UI panels: metric strips, colored severity
   cards, data tables, progress bars, sparklines.
   ═══════════════════════════════════════════════════════════════════ */

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* ── Brand palette ── */
const GREEN: RGB = [0.08, 0.24, 0.17];
const RED: RGB = [0.93, 0.27, 0.27];
const AMBER: RGB = [0.96, 0.62, 0.04];
const TEAL: RGB = [0.09, 0.64, 0.29];

function sevType(sev: string): "critical" | "warning" | "info" {
  const s = sev.toLowerCase();
  return s === "high" ? "critical" : s === "med" ? "warning" : "info";
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

/* ── Export types ── */

export type PrepareFieldDetailReportArtifactInput = {
  fieldId: string;
  fieldName: string;
  areaLabel: string;
  report: FieldReportProps | null;
  summary: FieldSummaryProps | null;
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

/* ── Block builder ── */

function buildBlocks(input: PrepareFieldDetailReportArtifactInput): PdfBlock[] {
  const blocks: PdfBlock[] = [];
  const r = input.report;
  const s = input.summary;
  const generatedAt = input.generatedAt ?? new Date().toISOString();

  /* ━━ COVER ━━ */

  blocks.push({ kind: "text", style: "title", text: `${input.fieldName} Field Report` });
  blocks.push({
    kind: "text",
    style: "caption",
    text: `Field Report · ${r?.updatedDate ?? generatedAt.slice(0, 10)} · ${r?.lld ?? s?.lld ?? ""}`,
  });

  // Health status badge
  if (r) {
    const ok = /healthy|good|normal/i.test(r.healthStatus);
    blocks.push({
      kind: "status-badge",
      label: r.healthStatus,
      color: ok ? TEAL : r.alerts.length > 0 ? RED : AMBER,
      marginTop: 6,
    });
  }

  // Field identity
  blocks.push({
    kind: "key-value",
    pairs: [
      { key: "Crop", value: s?.crop ?? "—" },
      { key: "Stage", value: r?.cropStage ?? s?.cropStage ?? "—" },
      { key: "Area", value: input.areaLabel },
      { key: "LLD", value: r?.lld ?? s?.lld ?? "—" },
    ],
    columns: 2,
    marginTop: 8,
  });

  if (r) {
    blocks.push({
      kind: "metric-strip",
      cells: [
        { label: "Updated", value: r.updatedDate || generatedAt.slice(0, 10) },
        { label: "Alerts", value: String(r.alerts.length), valueColor: r.alerts.length > 0 ? RED : TEAL },
        { label: "Findings", value: String(r.findings.length), valueColor: r.findings.length > 0 ? AMBER : TEAL },
        { label: "Zones", value: String(r.zones.length), valueColor: r.zones.length > 0 ? GREEN : undefined },
      ],
      marginTop: 6,
    });

    blocks.push({
      kind: "text",
      style: "caption",
      text: `Generated from the current FDP field report model, including live readings, atmospheric conditions, intelligence findings, tracked zones, and report provenance.`,
    });
  }

  /* ━━ CURRENT READINGS ━━ */

  if (r && r.readings.length > 0) {
    blocks.push({
      kind: "section-header",
      label: "Current Readings",
      meta: `${r.readings.length} metrics`,
      accentColor: GREEN,
    });

    blocks.push({
      kind: "metric-strip",
      cells: r.readings.slice(0, 5).map((rd) => ({
        label: rd.label,
        value: rd.value,
        valueColor: rd.valueColor ? hexToRgb(rd.valueColor) : undefined,
      })),
      marginTop: 10,
    });

    if (r.readings.length > 5) {
      blocks.push({
        kind: "metric-grid",
        cells: r.readings.slice(5).map((rd) => ({
          label: rd.label,
          value: rd.value,
          valueColor: rd.valueColor ? hexToRgb(rd.valueColor) : undefined,
        })),
        columns: 4,
        marginTop: 4,
      });
    }
  }

  /* ━━ CONDITIONS ━━ */

  if (s) {
    blocks.push({
      kind: "section-header",
      label: "Conditions",
      meta: s.conditionsMeta ?? "Field average",
    });

    blocks.push({
      kind: "metric-grid",
      cells: [
        { label: "Root Moisture", value: s.rootMoisture, sub: s.rootMoistureSub },
        { label: "Trend (7d)", value: s.trend, sub: s.trendSub, valueColor: AMBER },
        { label: "Spread (σ)", value: s.spread, sub: s.spreadSub },
        { label: "Confidence", value: s.confidence, sub: s.confidenceSub },
      ],
      columns: 4,
      marginTop: 4,
    });

    blocks.push({
      kind: "section-header",
      label: "Atmosphere",
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
      marginTop: 4,
    });
  }

  /* ━━ CROP PARAMETER ASSESSMENT ━━ */

  if (r && r.cropParams.length > 0) {
    blocks.push({
      kind: "section-header",
      label: "Crop Parameter Assessment",
      meta: r.cropStage,
    });

    for (const p of r.cropParams) {
      blocks.push({
        kind: "progress-bar",
        label: p.label,
        value: p.value,
        percent: p.fillPercent,
        fillColor: GREEN,
        rangeLabels: [p.rangeLow, p.rangeHigh],
        marginTop: 4,
      });
    }
  }

  /* ━━ CHART SPARKLINES ━━ */

  if (r && r.charts.length > 0) {
    blocks.push({
      kind: "section-header",
      label: "Trend History",
      meta: `${r.charts.length} chart${r.charts.length === 1 ? "" : "s"}`,
    });

    for (const chart of r.charts) {
      const series = chartSparkSeries(chart);
      if (series.length > 0) {
        blocks.push({
          kind: "multi-sparkline",
          label: `${chart.title} — ${chart.subtitle}`,
          series,
          marginTop: 10,
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

  /* ━━ 7-DAY FORECAST ━━ */

  if (r && r.forecast.length > 0) {
    blocks.push({
      kind: "section-header",
      label: "7-Day Forecast",
    });

    blocks.push({
      kind: "table",
      columns: [
        { label: "Day", width: 0.25 },
        { label: "Temperature", width: 0.40 },
        { label: "Precipitation", width: 0.35, align: "right" },
      ],
      rows: r.forecast.map((day) => ({
        cells: [day.day, day.temp, day.precip],
      })),
      marginTop: 4,
    });
  }

  /* ━━ ALERTS ━━ */

  const alertCount = r?.alerts.length ?? 0;
  blocks.push({
    kind: "section-header",
    label: "Active Alerts",
    meta: `${alertCount} active`,
    accentColor: alertCount > 0 ? RED : GREEN,
  });

  if (!r || alertCount === 0) {
    blocks.push({
      kind: "text",
      style: "body",
      text: r?.alertsEmptyStateDescription ?? "No active alerts. Field conditions are within expected parameters.",
    });
  } else {
    for (const alert of r.alerts.slice(0, 10)) {
      blocks.push({
        kind: "severity-card",
        severity: sevType(alert.severity),
        title: alert.text,
        detail: alert.detail ?? undefined,
        body: alert.trackedZoneIds.length > 0
          ? `${alert.trackedZoneIds.length} tracked zone${alert.trackedZoneIds.length > 1 ? "s" : ""} linked`
          : undefined,
        marginTop: 4,
      });
    }
  }

  /* ━━ FINDINGS ━━ */

  if (r && r.findings.length > 0) {
    blocks.push({
      kind: "section-header",
      label: "Intelligence Findings",
      meta: `${r.findings.length} active`,
      accentColor: AMBER,
    });

    for (const f of r.findings.slice(0, 10)) {
      blocks.push({
        kind: "severity-card",
        severity: sevType(f.severity),
        title: f.title,
        body: f.summary ?? undefined,
        marginTop: 4,
      });
    }
  }

  /* ━━ TRACKED ZONES ━━ */

  if (r && r.zones.length > 0) {
    blocks.push({
      kind: "section-header",
      label: "Tracked Zones",
      meta: `${r.zones.length} zones`,
    });

    blocks.push({
      kind: "table",
      columns: [
        { label: "Family", width: 0.25 },
        { label: "Status", width: 0.18 },
        { label: "Severity", width: 0.15 },
        { label: "Cells", width: 0.12, align: "right" },
        { label: "Last Seen", width: 0.30 },
      ],
      rows: r.zones.slice(0, 12).map((z) => ({
        cells: [z.family, z.status, z.severity ?? "—", String(z.affectedCellCount), z.lastSeenAt],
        accentColor: z.status === "critical" ? RED : z.status === "stressed" ? AMBER : undefined,
      })),
      marginTop: 4,
    });
  }

  /* ━━ PROVENANCE ━━ */

  blocks.push({ kind: "divider", marginTop: 16 });

  if (r) {
    blocks.push({
      kind: "section-header",
      label: "Provenance",
      accentColor: GREEN,
    });
    blocks.push({ kind: "text", style: "caption", text: r.provenanceText });
    if (r.sources.length > 0) {
      blocks.push({
        kind: "text",
        style: "caption",
        text: `Sources: ${r.sources.map((src) => src.label).join(" · ")}`,
      });
    }
  }

  blocks.push({
    kind: "text",
    style: "caption",
    text: "This report was generated by NocPulse and reflects conditions at the time of data collection. Verify critical decisions with on-ground observation.",
  });

  return blocks;
}

/* ── Public API ── */

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
    subject: `Field report for ${input.fieldName}`,
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
