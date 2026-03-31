import { renderPdfDocument } from "@fieldpulse/pdf";
import type { PdfBlock } from "@fieldpulse/pdf";
import type { FieldSummaryProps } from "../../components/panels/SummaryTab";
import type {
  FieldReportProps,
  ReportAlertItem,
  ReportChartSection,
  ReportFindingItem,
  ReportZoneItem,
} from "../../components/panels/ReportTab";

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* ── Helpers ── */

function severityIntent(severity: "High" | "Med" | "Low" | string): "danger" | "warning" | "info" {
  if (severity === "High") return "danger";
  if (severity === "Med") return "warning";
  return "info";
}

function summarizeChart(chart: ReportChartSection): string {
  const seriesSummaries = chart.series.map((series) => {
    const populated = series.points.filter((point) => typeof point.value === "number");
    const latest = [...populated].reverse()[0];
    return latest
      ? `${series.label}: ${latest.value} (${latest.label})`
      : `${series.label}: unavailable`;
  });

  return `${chart.subtitle} ${seriesSummaries.join(" · ")}`.trim();
}

/* ── Builder ── */

export function prepareFieldDetailReportArtifact(input: {
  fieldId: string;
  fieldName: string;
  areaHaLabel: string;
  summary: FieldSummaryProps | null;
  report: FieldReportProps | null;
}) {
  const report = input.report;
  const summary = input.summary;
  const reportDate = new Date().toISOString().slice(0, 10);
  const artifactKey = `field-detail-report/${input.fieldId}/${reportDate}.pdf`;
  const blocks: PdfBlock[] = [];

  /* ── Header ── */

  blocks.push({ style: "title", text: `Field report: ${input.fieldName}` });
  blocks.push({
    style: "caption",
    text: `Generated ${new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`,
  });

  blocks.push({ type: "spacer", height: 6 });
  blocks.push({ type: "divider" });
  blocks.push({ type: "spacer", height: 4 });

  /* ── Field overview (key-value pairs) ── */

  blocks.push({ style: "heading", text: "Field overview" });

  const healthStatus = report?.healthStatus ?? summary?.fieldState ?? "—";
  const healthIntent: "positive" | "warning" | "danger" | "neutral" =
    /healthy|good/i.test(healthStatus) ? "positive"
    : /stress|critical/i.test(healthStatus) ? "danger"
    : /watch|caution/i.test(healthStatus) ? "warning"
    : "neutral";

  blocks.push({ type: "status", label: "Status", status: healthStatus, intent: healthIntent });

  blocks.push({ type: "key-value", label: "Area", value: input.areaHaLabel });
  blocks.push({
    type: "key-value",
    label: "Legal land description",
    value: report?.lld ?? summary?.lld ?? "—",
  });
  blocks.push({ type: "key-value", label: "Crop", value: summary?.crop ?? "—" });
  blocks.push({
    type: "key-value",
    label: "Stage",
    value: summary?.cropStage ?? report?.cropStage ?? "—",
  });
  blocks.push({
    type: "key-value",
    label: "Updated",
    value: report?.updatedDate ?? summary?.updatedLabel ?? "—",
  });

  if (summary?.contextLabel) {
    blocks.push({ type: "key-value", label: "Context", value: summary.contextLabel });
  }
  if (summary?.conditionsMeta) {
    blocks.push({ type: "key-value", label: "Conditions", value: summary.conditionsMeta });
  }

  blocks.push({ type: "spacer", height: 6 });
  blocks.push({ type: "divider" });

  /* ── Conditions snapshot (from summary tab) ── */

  if (summary) {
    blocks.push({ style: "heading", text: "Conditions snapshot" });

    blocks.push({
      type: "metric-row",
      items: [
        { label: "Moisture", value: `${summary.moisture}%` },
        { label: "Cloud cover", value: summary.cloudCover },
        { label: "Surface moisture", value: summary.surfaceMoisture },
      ],
    });
    blocks.push({
      type: "metric-row",
      items: [
        { label: "Root moisture", value: `${summary.rootMoisture} ${summary.rootMoistureSub}` },
        { label: "Trend", value: `${summary.trend} ${summary.trendSub}` },
        { label: "Spread", value: `${summary.spread} ${summary.spreadSub}` },
        { label: "Confidence", value: `${summary.confidence} ${summary.confidenceSub}` },
      ],
    });

    blocks.push({ type: "spacer", height: 4 });
    blocks.push({ style: "subheading", text: "Precipitation" });
    blocks.push({
      type: "metric-row",
      items: [
        { label: "Current", value: `${summary.precipitation} ${summary.precipitationSub}` },
        { label: "Next rain", value: `${summary.nextRain} ${summary.nextRainSub}` },
        { label: "Rain chance", value: `${summary.rainChance} ${summary.rainChanceSub}` },
        { label: "7-day total", value: `${summary.sevenDayTotal} ${summary.sevenDayTotalSub}` },
      ],
    });

    blocks.push({ type: "spacer", height: 6 });
    blocks.push({ type: "divider" });
  }

  /* ── Current readings (metric row) ── */

  blocks.push({ style: "heading", text: "Current readings" });

  const readings = report?.readings ?? [];
  if (readings.length === 0) {
    blocks.push({ style: "body", text: "No readings available." });
  } else {
    // Chunk into rows of 4
    for (let i = 0; i < readings.length; i += 4) {
      const chunk = readings.slice(i, i + 4);
      blocks.push({
        type: "metric-row",
        items: chunk.map((r) => ({ label: r.label, value: r.value })),
      });
    }
  }

  blocks.push({ type: "spacer", height: 6 });
  blocks.push({ type: "divider" });

  /* ── Crop parameter assessment (key-value with range suffix) ── */

  blocks.push({ style: "heading", text: "Crop parameter assessment" });

  const cropParams = report?.cropParams ?? [];
  if (cropParams.length === 0) {
    blocks.push({ style: "body", text: "None." });
  } else {
    for (const param of cropParams) {
      blocks.push({
        type: "key-value",
        label: param.label,
        value: param.value,
        suffix: `${param.rangeLow}–${param.rangeHigh}`,
      });
    }
  }

  blocks.push({ type: "spacer", height: 6 });
  blocks.push({ type: "divider" });

  /* ── Trend history ── */

  blocks.push({ style: "heading", text: "Trend history" });

  const charts = report?.charts ?? [];
  if (charts.length === 0) {
    blocks.push({ style: "body", text: "No report charts available." });
  } else {
    for (const chart of charts) {
      blocks.push({ style: "subheading", text: chart.title });
      blocks.push({ style: "body", text: summarizeChart(chart) });
      if (chart.emptyText) {
        blocks.push({ style: "caption", text: chart.emptyText });
      }
    }
  }

  blocks.push({ type: "spacer", height: 6 });
  blocks.push({ type: "divider" });

  /* ── 7-day outlook (key-value pairs) ── */

  blocks.push({ style: "heading", text: "7-day outlook" });

  const forecast = report?.forecast ?? [];
  if (forecast.length === 0) {
    blocks.push({ style: "body", text: "None." });
  } else {
    for (const day of forecast) {
      blocks.push({
        type: "key-value",
        label: day.day,
        value: day.temp,
        suffix: day.precip,
      });
    }
  }

  blocks.push({ type: "spacer", height: 6 });
  blocks.push({ type: "divider" });

  /* ── Active alerts (status blocks) ── */

  blocks.push({ style: "heading", text: "Active alerts" });

  const alerts = report?.alerts ?? [];
  if (alerts.length === 0) {
    blocks.push({ style: "body", text: report?.alertsEmptyStateTitle ?? "None." });
    if (report?.alertsEmptyStateDescription) {
      blocks.push({ style: "caption", text: report.alertsEmptyStateDescription });
    }
  } else {
    for (const alert of alerts) {
      blocks.push({
        type: "status",
        label: alert.text,
        status: alert.severity,
        intent: severityIntent(alert.severity),
      });
      if (alert.detail) {
        blocks.push({ style: "caption", text: alert.detail });
      }
      if (alert.trackedZoneIds.length > 0) {
        blocks.push({ style: "caption", text: `Zones: ${alert.trackedZoneIds.join(", ")}` });
      }
    }
  }

  blocks.push({ type: "spacer", height: 6 });
  blocks.push({ type: "divider" });

  /* ── Findings (status blocks) ── */

  blocks.push({ style: "heading", text: "Findings" });

  const findings = report?.findings ?? [];
  if (findings.length === 0) {
    blocks.push({ style: "body", text: "None." });
  } else {
    for (const finding of findings) {
      blocks.push({
        type: "status",
        label: finding.title,
        status: finding.severity,
        intent: severityIntent(finding.severity),
      });
      if (finding.summary) {
        blocks.push({ style: "caption", text: finding.summary });
      }
      if (finding.trackedZoneIds.length > 0) {
        blocks.push({ style: "caption", text: `Zones: ${finding.trackedZoneIds.join(", ")}` });
      }
    }
  }

  blocks.push({ type: "spacer", height: 6 });
  blocks.push({ type: "divider" });

  /* ── Tracked zones (status blocks with details) ── */

  blocks.push({ style: "heading", text: "Tracked zones" });

  const zones = report?.zones ?? [];
  if (zones.length === 0) {
    blocks.push({ style: "body", text: "None." });
  } else {
    for (const zone of zones) {
      blocks.push({
        type: "status",
        label: zone.family,
        status: zone.severity ?? "None",
        intent: zone.severity ? severityIntent(zone.severity) : "neutral",
      });
      blocks.push({
        type: "metric-row",
        items: [
          { label: "Status", value: zone.status },
          { label: "Tracking", value: zone.trackingKey },
          { label: "Cells", value: String(zone.affectedCellCount) },
          { label: "Last seen", value: zone.lastSeenAt },
        ],
      });
      blocks.push({ type: "spacer", height: 4 });
    }
  }

  /* ── Summary alerts (from summary tab, if available and not duplicated by report alerts) ── */

  if (summary && summary.alerts.length > 0 && alerts.length === 0) {
    blocks.push({ type: "spacer", height: 6 });
    blocks.push({ type: "divider" });

    blocks.push({ style: "heading", text: "Summary alerts" });
    for (const sa of summary.alerts) {
      blocks.push({
        type: "status",
        label: sa.label,
        status: sa.severity,
        intent: sa.severity === "danger" ? "danger" : "warning",
      });
      if (sa.desc) {
        blocks.push({ style: "caption", text: sa.desc });
      }
    }
  }

  /* ── 7-day outlook detail (from summary tab) ── */

  if (summary && summary.outlook.length > 0) {
    blocks.push({ type: "spacer", height: 6 });
    blocks.push({ type: "divider" });

    blocks.push({ style: "heading", text: "7-day weather outlook" });
    for (const day of summary.outlook) {
      blocks.push({
        type: "key-value",
        label: day.day,
        value: `${day.high}° / ${day.low}°`,
        suffix: day.precip,
      });
    }
  }

  blocks.push({ type: "spacer", height: 6 });
  blocks.push({ type: "divider" });

  /* ── Provenance ── */

  blocks.push({ style: "heading", text: "Provenance" });
  blocks.push({ style: "body", text: report?.provenanceText ?? "No provenance available." });
  blocks.push({
    type: "key-value",
    label: "Sources",
    value: report?.sources.length
      ? report.sources.map((source) => source.label).join(", ")
      : "none",
  });

  /* ── Render ── */

  const pdf = renderPdfDocument({
    artifactKey,
    title: `Field report: ${input.fieldName}`,
    subject: "Field detail report export",
    author: "NocPulse",
    blocks,
  });

  return {
    bytes: pdf.bytes,
    contentType: "application/pdf" as const,
    cacheControl: "private, max-age=0, no-cache",
    fileName: `${slugify(input.fieldName)}-report-${reportDate}.pdf`,
  };
}
