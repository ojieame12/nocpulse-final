import type { PdfRenderInput, PdfBlock, RGB } from "@fieldpulse/pdf";
import type { FieldAlert } from "@fieldpulse/module-alerts";
import type { FieldIntelligenceFinding } from "@fieldpulse/module-crop-intelligence";
import type { FieldZoneActivityItem } from "@fieldpulse/module-crop-intelligence";
import type { FieldWeatherForecast } from "@fieldpulse/module-weather";
import type { FieldReportReadModel } from "../contracts/FieldReportReadModel";

/* ═══════════════════════════════════════════════════════════════════
   NocPulse Field Report — PDF Document Builder
   ───────────────────────────────────────────────────────────────────
   Produces a branded, visually structured report with:
   • Cover summary with vitals strip and status badge
   • Metric grids for moisture and weather data
   • Severity-colored alert and finding cards
   • Forecast table with proper column layout
   • Progress bars for crop thresholds
   • Tracked zone summary table
   • Data provenance footer
   ═══════════════════════════════════════════════════════════════════ */

type BuildFieldReportPdfRenderInput = {
  artifactKey: string;
  readModel: FieldReportReadModel;
};

/* ── Brand palette ── */

const GREEN: RGB = [0.08, 0.24, 0.17];
const RED: RGB = [0.93, 0.27, 0.27];
const AMBER: RGB = [0.96, 0.62, 0.04];
const TEAL: RGB = [0.09, 0.64, 0.29];

/* ── Helpers ── */

function fmt(value: number | null, digits = 1) {
  if (value === null || Number.isNaN(value)) return "—";
  return value.toFixed(digits);
}

function fmtPct(value: number | null, digits = 1) {
  if (value === null || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

function fmtTs(value: string | null) {
  if (!value) return "—";
  try {
    const d = new Date(value);
    return d.toLocaleDateString("en-CA", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value.replace("T", " ").slice(0, 19);
  }
}

function sevToType(severity: string): "critical" | "warning" | "info" {
  const s = severity.toLowerCase();
  if (s === "high" || s === "critical") return "critical";
  if (s === "medium" || s === "med" || s === "warning") return "warning";
  return "info";
}

function sevToColor(severity: string): RGB {
  const t = sevToType(severity);
  return t === "critical" ? RED : t === "warning" ? AMBER : TEAL;
}

/* ═══════════════════════════════════════════════════════════════════ */

export function buildFieldReportPdfRenderInput({
  artifactKey,
  readModel,
}: BuildFieldReportPdfRenderInput): PdfRenderInput {
  const blocks: PdfBlock[] = [];
  const m = readModel;
  const snap = m.moisture.latestSnapshot;
  const obs = m.weather.profile.latestObservation;
  const sig = m.weather.signals;
  const crop = m.cropContext;

  /* ━━ PAGE 1 — COVER ━━ */

  // Title
  blocks.push({ kind: "text", style: "title", text: m.field.name });
  blocks.push({
    kind: "text",
    style: "caption",
    text: `Field Report · ${m.reportDate.slice(0, 10)} · Generated ${fmtTs(m.generatedAt)}`,
  });

  blocks.push({ kind: "spacer", height: 6 });

  // Status badge
  const alertCount = m.summary.activeAlertCount;
  const hasAlerts = alertCount !== null && alertCount > 0;
  blocks.push({
    kind: "status-badge",
    label: hasAlerts
      ? `${alertCount} Active Alert${alertCount > 1 ? "s" : ""}`
      : "All Clear",
    color: hasAlerts ? RED : TEAL,
    marginTop: 4,
  });

  // Field identity strip
  blocks.push({
    kind: "key-value",
    pairs: [
      { key: "Crop", value: crop?.cropType ?? m.summary.cropType ?? "—" },
      {
        key: "Growth stage",
        value: crop?.growthStage ?? m.summary.growthStage ?? "—",
      },
      {
        key: "Area",
        value: `${fmt(m.field.areaHa, 2)} ha`,
      },
      {
        key: "LLD",
        value: m.intake.legalLandDescription ?? "—",
      },
    ],
    columns: 2,
    marginTop: 8,
  });

  // Vitals strip
  blocks.push({
    kind: "metric-strip",
    cells: [
      {
        label: "Root Zone",
        value: snap ? fmtPct(snap.rootZonePct) : "—",
        valueColor: snap && snap.rootZonePct !== null && snap.rootZonePct < 30
          ? RED
          : undefined,
      },
      {
        label: "Surface",
        value: snap ? fmtPct(snap.surfacePct) : "—",
      },
      {
        label: "Temperature",
        value: obs ? `${fmt(obs.airTemperatureC)}°C` : "—",
      },
      {
        label: "Wind",
        value: obs ? `${fmt(obs.windSpeedKph)} km/h` : "—",
      },
      {
        label: "Precipitation",
        value: obs ? `${fmt(obs.precipitationMm)} mm` : "—",
      },
    ],
    marginTop: 10,
  });

  // Operational summary
  blocks.push({
    kind: "section-header",
    label: "Operational Summary",
    meta: fmtTs(m.generatedAt),
    accentColor: GREEN,
  });

  blocks.push({
    kind: "metric-grid",
    cells: [
      {
        label: "Active Alerts",
        value: alertCount === null ? "Unavailable" : String(alertCount),
        valueColor: hasAlerts ? RED : undefined,
      },
      {
        label: "Active Findings",
        value: String(m.summary.activeFindingCount),
        valueColor: m.summary.activeFindingCount > 0 ? AMBER : undefined,
      },
      {
        label: "Tracked Zones",
        value: String(m.summary.trackedZoneCount),
      },
      {
        label: "Active Zones",
        value: String(m.summary.activeTrackedZoneCount),
        valueColor: m.summary.activeTrackedZoneCount > 0 ? AMBER : undefined,
      },
    ],
    columns: 4,
    marginTop: 4,
  });

  /* ━━ MOISTURE ━━ */

  blocks.push({
    kind: "section-header",
    label: "Moisture",
    meta: snap ? fmtTs(snap.observedAt) : "No data",
  });

  if (snap) {
    blocks.push({
      kind: "metric-grid",
      cells: [
        {
          label: "Root Zone",
          value: fmtPct(snap.rootZonePct),
          sub: `Avg ${fmtPct(m.moisture.rootZoneAvgPct)}`,
        },
        {
          label: "Surface",
          value: fmtPct(snap.surfacePct),
          sub: `Avg ${fmtPct(m.moisture.surfaceAvgPct)}`,
        },
        {
          label: "Confidence",
          value: snap.confidence ?? "—",
          sub: `${m.moisture.lowConfidenceCellCount} low-conf cells`,
        },
        {
          label: "Total Cells",
          value: String(m.moisture.latestCellCount),
          sub: `Source: ${snap.sourceKey ?? "unknown"}`,
        },
      ],
      columns: 4,
      marginTop: 4,
    });

    blocks.push({
      kind: "progress-bar",
      label: "Root Zone Range",
      value: `${fmtPct(m.moisture.rootZoneMinPct)} – ${fmtPct(m.moisture.rootZoneMaxPct)}`,
      percent: m.moisture.rootZoneAvgPct ?? 50,
      fillColor: GREEN,
      rangeLabels: ["0%", "100%"],
      marginTop: 6,
    });
  } else {
    blocks.push({
      kind: "text",
      style: "body",
      text: "No moisture snapshot available for this report date.",
    });
  }

  /* ━━ WEATHER ━━ */

  blocks.push({
    kind: "section-header",
    label: "Weather Observations",
    meta: obs ? fmtTs(obs.observedAt) : "No data",
  });

  if (obs) {
    blocks.push({
      kind: "metric-grid",
      cells: [
        { label: "Air Temp", value: `${fmt(obs.airTemperatureC)}°C` },
        { label: "Precipitation", value: `${fmt(obs.precipitationMm)} mm` },
        { label: "Wind", value: `${fmt(obs.windSpeedKph)} km/h` },
        { label: "Humidity", value: fmtPct(obs.relativeHumidityPct) },
      ],
      columns: 4,
      marginTop: 4,
    });
  } else {
    blocks.push({
      kind: "text",
      style: "body",
      text: "Weather observation data was unavailable when this report was built.",
    });
  }

  /* ━━ DERIVED SIGNALS ━━ */

  if (sig) {
    blocks.push({
      kind: "section-header",
      label: "Derived Signals",
      meta: fmtTs(sig.observedAt),
    });

    blocks.push({
      kind: "metric-grid",
      cells: [
        { label: "VPD Now", value: `${fmt(sig.currentVpdKpa, 2)} kPa` },
        { label: "Peak VPD 24h", value: `${fmt(sig.peakForecastVpdKpa24h, 2)} kPa` },
        { label: "Water Bal 24h", value: `${fmt(sig.netWaterBalance24hMm, 1)} mm` },
        { label: "Water Bal 72h", value: `${fmt(sig.netWaterBalance72hMm, 1)} mm` },
        { label: "Leaf Wet Hrs", value: String(sig.leafWetHours24h ?? "—") },
        { label: "Spray Windows", value: String(sig.sprayWindowCount24h ?? "—") },
        { label: "Frost Min", value: `${fmt(sig.frostRiskMinTempC)}°C`, valueColor: sig.frostRiskMinTempC !== null && sig.frostRiskMinTempC < 0 ? RED : undefined },
        { label: "GDD 72h", value: fmt(sig.gdd72h, 1) },
      ],
      columns: 4,
      marginTop: 4,
    });
  }

  /* ━━ FORECAST TABLE ━━ */

  const forecasts = m.weather.profile.forecasts.slice(0, 8);
  if (forecasts.length > 0) {
    blocks.push({
      kind: "section-header",
      label: "Forecast",
      meta: `Next ${forecasts.length} periods`,
    });

    blocks.push({
      kind: "table",
      columns: [
        { label: "Time", width: 0.28 },
        { label: "Min", width: 0.12, align: "right" },
        { label: "Max", width: 0.12, align: "right" },
        { label: "Precip", width: 0.14, align: "right" },
        { label: "Wind", width: 0.14, align: "right" },
        { label: "Prob", width: 0.12, align: "right" },
      ],
      rows: forecasts.map((f) => ({
        cells: [
          fmtTs(f.validAt),
          `${fmt(f.airTemperatureMinC)}°`,
          `${fmt(f.airTemperatureMaxC)}°`,
          `${fmt(f.precipitationMm)} mm`,
          `${fmt(f.windSpeedKph)} km/h`,
          f.precipitationProbabilityPct !== null
            ? fmtPct(f.precipitationProbabilityPct, 0)
            : "—",
        ],
      })),
      marginTop: 4,
    });
  }

  /* ━━ ALERTS ━━ */

  blocks.push({
    kind: "section-header",
    label: "Active Alerts",
    meta: alertCount === null
      ? "Data unavailable"
      : `${m.alerts.length} active`,
    accentColor: hasAlerts ? RED : GREEN,
  });

  if (!m.dataAvailability.activeAlerts) {
    blocks.push({
      kind: "text",
      style: "body",
      text: "Alert data was unavailable when this report was built. Re-run the report before treating this field as all-clear.",
    });
  } else if (m.alerts.length === 0) {
    blocks.push({
      kind: "text",
      style: "body",
      text: "No active alerts. Field conditions are within expected parameters.",
    });
  } else {
    for (const alert of m.alerts.slice(0, 8)) {
      blocks.push({
        kind: "severity-card",
        severity: sevToType(alert.severity),
        title: alert.title,
        body: alert.summary ?? undefined,
        detail: alert.explanation ?? undefined,
        action: alert.recommendedAction ?? undefined,
        marginTop: 4,
      });
    }
    if (m.alerts.length > 8) {
      blocks.push({
        kind: "text",
        style: "caption",
        text: `+ ${m.alerts.length - 8} more alert${m.alerts.length - 8 > 1 ? "s" : ""} not shown.`,
      });
    }
  }

  /* ━━ FINDINGS ━━ */

  blocks.push({
    kind: "section-header",
    label: "Intelligence Findings",
    meta: `${m.findings.length} active`,
    accentColor: m.findings.length > 0 ? AMBER : GREEN,
  });

  if (m.findings.length === 0) {
    blocks.push({
      kind: "text",
      style: "body",
      text: "No active intelligence findings.",
    });
  } else {
    for (const finding of m.findings.slice(0, 8)) {
      blocks.push({
        kind: "severity-card",
        severity: sevToType(finding.severity),
        title: finding.title,
        body: finding.summary ?? undefined,
        detail: finding.explanation
          ? `${finding.explanation}${finding.affectedCellKeys.length > 0 ? ` · ${finding.affectedCellKeys.length} cells affected` : ""}`
          : undefined,
        action: finding.recommendedAction ?? undefined,
        marginTop: 4,
      });
    }
    if (m.findings.length > 8) {
      blocks.push({
        kind: "text",
        style: "caption",
        text: `+ ${m.findings.length - 8} more finding${m.findings.length - 8 > 1 ? "s" : ""} not shown.`,
      });
    }
  }

  /* ━━ TRACKED ZONES ━━ */

  const zones = m.zones;
  blocks.push({
    kind: "section-header",
    label: "Tracked Zones",
    meta: `${zones.totalZoneCount} total`,
  });

  blocks.push({
    kind: "metric-grid",
    cells: [
      { label: "New", value: String(zones.newZoneCount), valueColor: zones.newZoneCount > 0 ? RED : undefined },
      { label: "Persistent", value: String(zones.persistentZoneCount), valueColor: zones.persistentZoneCount > 0 ? AMBER : undefined },
      { label: "Recovering", value: String(zones.recoveringZoneCount), valueColor: zones.recoveringZoneCount > 0 ? TEAL : undefined },
      { label: "Resolved", value: String(zones.resolvedZoneCount) },
    ],
    columns: 4,
    marginTop: 4,
  });

  if (zones.zones.length > 0) {
    blocks.push({
      kind: "table",
      columns: [
        { label: "Status", width: 0.15 },
        { label: "Family", width: 0.25 },
        { label: "Severity", width: 0.15 },
        { label: "Cells", width: 0.12, align: "right" },
        { label: "First Seen", width: 0.18 },
        { label: "Last Seen", width: 0.15 },
      ],
      rows: zones.zones.slice(0, 12).map((z) => ({
        cells: [
          z.status.toUpperCase(),
          z.family,
          z.latestSeverity ?? "—",
          String(z.affectedCellCount),
          fmtTs(z.firstSeenAt),
          fmtTs(z.lastSeenAt),
        ],
        accentColor:
          z.latestSeverity === "critical" || z.latestSeverity === "high"
            ? RED
            : z.latestSeverity === "medium"
              ? AMBER
              : undefined,
      })),
      marginTop: 4,
    });
  }

  /* ━━ PROVENANCE FOOTER ━━ */

  blocks.push({ kind: "divider", marginTop: 16 });

  blocks.push({
    kind: "key-value",
    pairs: [
      { key: "Field ID", value: m.field.id },
      { key: "Workspace", value: m.field.workspaceId },
      { key: "Moisture observed", value: fmtTs(m.summary.moistureObservedAt) },
      { key: "Weather observed", value: fmtTs(m.summary.weatherObservedAt) },
      {
        key: "Coordinates",
        value: `${fmt(m.field.labelPoint[1], 5)}, ${fmt(m.field.labelPoint[0], 5)}`,
      },
      { key: "Report date", value: m.reportDate.slice(0, 10) },
    ],
    columns: 2,
    marginTop: 4,
  });

  blocks.push({
    kind: "text",
    style: "caption",
    text: "This report was generated by NocPulse and reflects conditions at the time of data collection. Verify critical decisions with on-ground observation.",
  });

  return {
    artifactKey,
    title: `Field Report: ${m.field.name}`,
    subject: `Operational report for ${m.field.name} on ${m.reportDate.slice(0, 10)}`,
    author: "NocPulse",
    blocks,
  };
}
