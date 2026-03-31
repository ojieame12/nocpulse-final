import type { PdfRenderInput, PdfBlock, RGB } from "@fieldpulse/pdf";
import type { FieldAlert } from "@fieldpulse/module-alerts";
import type { FieldIntelligenceFinding } from "@fieldpulse/module-crop-intelligence";
import type { FieldZoneActivityItem } from "@fieldpulse/module-crop-intelligence";
import type { FieldWeatherForecast } from "@fieldpulse/module-weather";
import type { FieldReportReadModel } from "../contracts/FieldReportReadModel";

/* ═══════════════════════════════════════════════════════════════════
   NocPulse Field Report — PDF Document Builder  (v2)
   ───────────────────────────────────────────────────────────────────
   Produces a branded, farmer-friendly report with:

   Page 1  — Cover with field identity, health badge, vitals,
             top-line action items from active alerts
   Page 2  — Moisture & weather conditions, crop parameter
             thresholds with color-coded progress bars
   Page 3  — 7-day forecast table, derived weather signals
   Page 4  — Alerts with recommended actions, intelligence findings
             with context, tracked zones summary table
   Footer  — Provenance, coordinates, data source timestamps
   ═══════════════════════════════════════════════════════════════════ */

type BuildFieldReportPdfRenderInput = {
  artifactKey: string;
  readModel: FieldReportReadModel;
};

/* ── Brand palette ── */

const GREEN: RGB = [0.08, 0.24, 0.17];
const GREEN_SOFT: RGB = [0.09, 0.64, 0.29];
const RED: RGB = [0.93, 0.27, 0.27];
const AMBER: RGB = [0.96, 0.62, 0.04];
const TEAL: RGB = [0.09, 0.64, 0.29];
const SLATE: RGB = [0.42, 0.44, 0.47];

/* ── Helpers ── */

function fmt(value: number | null, digits = 1) {
  if (value === null || Number.isNaN(value)) return "—";
  return value.toFixed(digits);
}

function fmtPct(value: number | null, digits = 1) {
  if (value === null || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

function fmtDate(value: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("en-CA", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return value.slice(0, 10);
  }
}

function fmtDateTime(value: string | null) {
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
    return value.replace("T", " ").slice(0, 16);
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

/** Derive a plain-language recommended action from an alert title. */
function inferAlertAction(alert: FieldAlert): string | undefined {
  const t = (alert.title + " " + (alert.summary ?? "")).toLowerCase();
  if (alert.recommendedAction) return alert.recommendedAction;
  if (t.includes("frost")) return "Check frost protection measures. Monitor overnight low temperatures closely.";
  if (t.includes("moisture stress") || t.includes("below")) return "Review irrigation scheduling. Prioritize affected zones.";
  if (t.includes("hail")) return "Assess crop damage risk and review insurance coverage.";
  if (t.includes("wind")) return "Delay field operations until wind subsides.";
  return undefined;
}

/** Infer a short weather description from forecast numeric data. */
function inferForecastConditions(f: FieldWeatherForecast): string {
  const minT = f.airTemperatureMinC;
  const precip = f.precipitationMm ?? 0;
  const wind = f.windSpeedKph ?? 0;

  if (minT !== null && minT <= -10) return precip >= 2 ? "Snow likely" : "Deep frost";
  if (minT !== null && minT <= 0) return precip >= 2 ? "Rain/snow mix" : "Frost risk";
  if (precip >= 10) return "Heavy rain";
  if (precip >= 2) return "Light rain";
  if (wind >= 40) return "High wind";
  if (precip > 0) return "Chance of showers";
  return "Dry";
}

/** Derive a plain-language action from a finding. */
function inferFindingAction(finding: FieldIntelligenceFinding): string | undefined {
  if (finding.recommendedAction) return finding.recommendedAction;
  const t = (finding.title + " " + (finding.summary ?? "")).toLowerCase();
  if (t.includes("frost")) return "Monitor overnight lows. Activate frost mitigation if available.";
  if (t.includes("moisture")) return "Review irrigation for the upcoming week.";
  if (t.includes("stress")) return "Ground-truth stressed zones within the next 48 hours.";
  return undefined;
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

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     PAGE 1 — COVER
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

  // Title
  blocks.push({ kind: "text", style: "title", text: m.field.name });
  blocks.push({
    kind: "text",
    style: "subheading",
    text: `Field Report — ${fmtDate(m.reportDate)}`,
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

  blocks.push({ kind: "spacer", height: 4 });

  // Field identity
  blocks.push({
    kind: "key-value",
    pairs: [
      { key: "Crop", value: crop?.cropType ?? m.summary.cropType ?? "—" },
      { key: "Growth Stage", value: crop?.growthStage ?? m.summary.growthStage ?? "—" },
      { key: "Field Size", value: `${fmt(m.field.areaHa, 1)} ha` },
      { key: "Legal Land", value: m.intake.legalLandDescription ?? "—" },
    ],
    columns: 2,
    marginTop: 6,
  });

  // Vitals strip — the 5 most important numbers
  blocks.push({
    kind: "metric-strip",
    cells: [
      {
        label: "Root Zone",
        value: snap ? fmtPct(snap.rootZonePct) : "—",
        valueColor: snap && snap.rootZonePct !== null && snap.rootZonePct < 30 ? RED : undefined,
      },
      {
        label: "Surface",
        value: snap ? fmtPct(snap.surfacePct) : "—",
      },
      {
        label: "Temperature",
        value: obs ? `${fmt(obs.airTemperatureC)}°C` : "—",
        valueColor: obs && obs.airTemperatureC !== null && obs.airTemperatureC < -5 ? RED : undefined,
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
    marginTop: 8,
  });

  // Quick summary counts
  blocks.push({
    kind: "metric-grid",
    cells: [
      {
        label: "Active Alerts",
        value: alertCount === null ? "Unavailable" : String(alertCount),
        valueColor: hasAlerts ? RED : undefined,
      },
      {
        label: "Findings",
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
    marginTop: 6,
  });

  /* ── Top-line Action Items (if any alerts) ── */

  if (hasAlerts && m.alerts.length > 0) {
    blocks.push({ kind: "spacer", height: 6 });
    blocks.push({
      kind: "section-header",
      label: "Action Required",
      meta: `${m.alerts.length} item${m.alerts.length > 1 ? "s" : ""}`,
      accentColor: RED,
    });

    for (const alert of m.alerts.slice(0, 3)) {
      blocks.push({
        kind: "severity-card",
        severity: sevToType(alert.severity),
        title: alert.title,
        body: alert.summary ?? undefined,
        action: inferAlertAction(alert),
        marginTop: 4,
      });
    }
    if (m.alerts.length > 3) {
      blocks.push({
        kind: "text",
        style: "caption",
        text: `+ ${m.alerts.length - 3} more — see Alerts section.`,
      });
    }
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     PAGE 2 — MOISTURE & WEATHER CONDITIONS
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

  blocks.push({ kind: "spacer", height: 10 });
  blocks.push({
    kind: "section-header",
    label: "Moisture Conditions",
    meta: snap ? fmtDate(snap.observedAt) : "No data",
    accentColor: GREEN,
  });

  if (snap) {
    blocks.push({
      kind: "metric-grid",
      cells: [
        {
          label: "Root Zone",
          value: fmtPct(snap.rootZonePct),
          sub: `Field avg ${fmtPct(m.moisture.rootZoneAvgPct)}`,
          valueColor: snap.rootZonePct !== null && snap.rootZonePct < 30 ? RED : undefined,
        },
        {
          label: "Surface",
          value: fmtPct(snap.surfacePct),
          sub: `Field avg ${fmtPct(m.moisture.surfaceAvgPct)}`,
        },
        {
          label: "Confidence",
          value: snap.confidence ?? "—",
          sub: `${m.moisture.lowConfidenceCellCount} low-confidence cells`,
        },
        {
          label: "Mapped Cells",
          value: String(m.moisture.latestCellCount),
          sub: `Range ${fmtPct(m.moisture.rootZoneMinPct)} – ${fmtPct(m.moisture.rootZoneMaxPct)}`,
        },
      ],
      columns: 4,
      marginTop: 6,
    });

    // Root zone progress bar
    blocks.push({
      kind: "progress-bar",
      label: "Root Zone Moisture",
      value: fmtPct(m.moisture.rootZoneAvgPct),
      percent: m.moisture.rootZoneAvgPct ?? 50,
      fillColor: (m.moisture.rootZoneAvgPct ?? 50) < 25 ? RED : GREEN_SOFT,
      rangeLabels: ["0%", "100%"],
      marginTop: 8,
    });

    // Surface progress bar
    blocks.push({
      kind: "progress-bar",
      label: "Surface Moisture",
      value: fmtPct(m.moisture.surfaceAvgPct),
      percent: m.moisture.surfaceAvgPct ?? 50,
      fillColor: (m.moisture.surfaceAvgPct ?? 50) < 20 ? RED : GREEN_SOFT,
      rangeLabels: ["0%", "100%"],
      marginTop: 4,
    });
  } else {
    blocks.push({
      kind: "text",
      style: "body",
      text: "No moisture data available for this report date. This usually means no satellite pass has been processed yet.",
    });
  }

  /* ── Weather Observations ── */

  blocks.push({ kind: "spacer", height: 10 });
  blocks.push({
    kind: "section-header",
    label: "Weather Observations",
    meta: obs ? fmtDateTime(obs.observedAt) : "No data",
    accentColor: GREEN,
  });

  if (obs) {
    blocks.push({
      kind: "metric-grid",
      cells: [
        {
          label: "Temperature",
          value: `${fmt(obs.airTemperatureC)}°C`,
          valueColor: obs.airTemperatureC !== null && obs.airTemperatureC < -5 ? RED : undefined,
        },
        { label: "Precipitation", value: `${fmt(obs.precipitationMm)} mm` },
        { label: "Wind Speed", value: `${fmt(obs.windSpeedKph)} km/h` },
        { label: "Humidity", value: fmtPct(obs.relativeHumidityPct) },
      ],
      columns: 4,
      marginTop: 6,
    });
  } else {
    blocks.push({
      kind: "text",
      style: "body",
      text: "Weather observation data was unavailable when this report was generated.",
    });
  }

  /* ── Derived Weather Signals ── */

  if (sig) {
    blocks.push({ kind: "spacer", height: 8 });
    blocks.push({
      kind: "section-header",
      label: "Derived Weather Signals",
      meta: fmtDate(sig.observedAt),
      accentColor: GREEN,
    });

    blocks.push({
      kind: "metric-grid",
      cells: [
        { label: "VPD Now", value: `${fmt(sig.currentVpdKpa, 2)} kPa` },
        { label: "Peak VPD (24h)", value: `${fmt(sig.peakForecastVpdKpa24h, 2)} kPa` },
        {
          label: "Water Balance (24h)",
          value: `${fmt(sig.netWaterBalance24hMm, 1)} mm`,
          valueColor: sig.netWaterBalance24hMm !== null && sig.netWaterBalance24hMm < -5 ? AMBER : undefined,
        },
        {
          label: "Water Balance (72h)",
          value: `${fmt(sig.netWaterBalance72hMm, 1)} mm`,
          valueColor: sig.netWaterBalance72hMm !== null && sig.netWaterBalance72hMm < -10 ? RED : undefined,
        },
      ],
      columns: 4,
      marginTop: 6,
    });

    blocks.push({
      kind: "metric-grid",
      cells: [
        { label: "Leaf Wet Hours", value: String(sig.leafWetHours24h ?? "—") },
        { label: "Spray Windows", value: String(sig.sprayWindowCount24h ?? "—") },
        {
          label: "Frost Risk Min",
          value: `${fmt(sig.frostRiskMinTempC)}°C`,
          valueColor: sig.frostRiskMinTempC !== null && sig.frostRiskMinTempC < 0 ? RED : undefined,
        },
        { label: "GDD (72h)", value: fmt(sig.gdd72h, 1) },
      ],
      columns: 4,
      marginTop: 4,
    });

    // Frost risk progress bar if relevant
    if (sig.frostRiskMinTempC !== null && sig.frostRiskMinTempC < 2) {
      blocks.push({
        kind: "progress-bar",
        label: "Frost Risk",
        value: `${fmt(sig.frostRiskMinTempC)}°C`,
        percent: Math.max(0, Math.min(100, ((sig.frostRiskMinTempC + 4) / 6) * 100)),
        fillColor: sig.frostRiskMinTempC < 0 ? RED : AMBER,
        rangeLabels: ["-4°C", ">-2°C"],
        marginTop: 6,
      });
    }
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     PAGE 3 — FORECAST
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

  const forecasts = m.weather.profile.forecasts.slice(0, 8);
  if (forecasts.length > 0) {
    blocks.push({ kind: "spacer", height: 10 });
    blocks.push({
      kind: "section-header",
      label: "Forecast",
      meta: `Next ${forecasts.length} periods`,
      accentColor: GREEN,
    });

    blocks.push({
      kind: "table",
      columns: [
        { label: "Time", width: 0.18 },
        { label: "Conditions", width: 0.16 },
        { label: "Min", width: 0.09, align: "right" },
        { label: "Max", width: 0.09, align: "right" },
        { label: "Precip", width: 0.14, align: "right" },
        { label: "Wind", width: 0.14, align: "right" },
        { label: "Chance", width: 0.12, align: "right" },
      ],
      headerBg: GREEN,
      rows: forecasts.map((f) => ({
        cells: [
          fmtDate(f.validAt),
          inferForecastConditions(f),
          `${fmt(f.airTemperatureMinC)}°`,
          `${fmt(f.airTemperatureMaxC)}°`,
          `${fmt(f.precipitationMm)} mm`,
          `${fmt(f.windSpeedKph)} km/h`,
          f.precipitationProbabilityPct !== null
            ? fmtPct(f.precipitationProbabilityPct, 0)
            : "—",
        ],
        accentColor:
          f.airTemperatureMinC !== null && f.airTemperatureMinC <= 0
            ? RED
            : f.precipitationMm !== null && f.precipitationMm >= 10
              ? ([0.23, 0.51, 0.85] as RGB)
              : f.windSpeedKph !== null && f.windSpeedKph >= 40
                ? AMBER
                : undefined,
      })),
      marginTop: 6,
    });

    // Precipitation sparkline from forecast data
    const precipValues = forecasts
      .map((f) => f.precipitationMm ?? 0);
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

    // Temperature window — High vs Low sparklines
    const tempHighs = forecasts
      .map((f) => f.airTemperatureMaxC)
      .filter((v): v is number => v !== null);
    const tempLows = forecasts
      .map((f) => f.airTemperatureMinC)
      .filter((v): v is number => v !== null);
    if (tempHighs.length >= 2 && tempLows.length >= 2) {
      blocks.push({
        kind: "multi-sparkline",
        label: "Forecast Temperature Window (°C)",
        series: [
          { label: "High", data: tempHighs, color: RED },
          { label: "Low", data: tempLows, color: [0.23, 0.51, 0.85] as RGB },
        ],
        height: 56,
        marginTop: 8,
      });
    }
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     PAGE 4 — ALERTS, FINDINGS & ZONES
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

  /* ── Alerts ── */

  blocks.push({ kind: "spacer", height: 10 });
  blocks.push({
    kind: "section-header",
    label: "Alerts",
    meta: alertCount === null
      ? "Data unavailable"
      : hasAlerts ? `${m.alerts.length} active` : "All clear",
    accentColor: hasAlerts ? RED : GREEN,
  });

  if (!m.dataAvailability.activeAlerts) {
    blocks.push({
      kind: "text",
      style: "body",
      text: "Alert data was unavailable when this report was generated. Re-run the report before treating this field as all-clear.",
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
        action: inferAlertAction(alert),
        marginTop: 6,
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

  /* ── Findings ── */

  if (m.findings.length > 0) {
    blocks.push({ kind: "spacer", height: 10 });
    blocks.push({
      kind: "section-header",
      label: "Intelligence Findings",
      meta: `${m.findings.length} active`,
      accentColor: AMBER,
    });

    blocks.push({
      kind: "text",
      style: "caption",
      text: "NocPulse intelligence combines satellite, weather, and crop models to detect issues early.",
    });

    for (const finding of m.findings.slice(0, 8)) {
      blocks.push({
        kind: "severity-card",
        severity: sevToType(finding.severity),
        title: finding.title,
        body: finding.summary ?? undefined,
        detail: finding.explanation
          ? `${finding.explanation}${finding.affectedCellKeys.length > 0 ? ` — ${finding.affectedCellKeys.length} cells affected` : ""}`
          : undefined,
        action: inferFindingAction(finding),
        marginTop: 6,
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

  /* ── Tracked Zones ── */

  const zones = m.zones;
  if (zones.totalZoneCount > 0) {
    blocks.push({ kind: "spacer", height: 10 });
    blocks.push({
      kind: "section-header",
      label: "Tracked Zones",
      meta: `${zones.totalZoneCount} total`,
      accentColor: GREEN,
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
      marginTop: 6,
    });

    if (zones.zones.length > 0) {
      blocks.push({
        kind: "table",
        columns: [
          { label: "Type", width: 0.20 },
          { label: "Status", width: 0.14 },
          { label: "Severity", width: 0.14 },
          { label: "Cells", width: 0.12, align: "right" },
          { label: "First Seen", width: 0.20 },
          { label: "Last Seen", width: 0.20 },
        ],
        headerBg: GREEN,
        rows: zones.zones.slice(0, 12).map((z) => ({
          cells: [
            z.family.replace(/_/g, " "),
            z.status,
            z.latestSeverity ?? "—",
            String(z.affectedCellCount),
            fmtDate(z.firstSeenAt),
            fmtDate(z.lastSeenAt),
          ],
          accentColor:
            z.latestSeverity === "critical" || z.latestSeverity === "high" ? RED
              : z.latestSeverity === "medium" ? AMBER
                : undefined,
        })),
        marginTop: 6,
      });
    }
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     FOOTER — PROVENANCE
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

  blocks.push({ kind: "spacer", height: 12 });
  blocks.push({ kind: "divider", marginTop: 8, color: SLATE, thickness: 0.5 });

  blocks.push({
    kind: "section-header",
    label: "Data Sources & Provenance",
    accentColor: GREEN,
    marginTop: 6,
  });

  blocks.push({
    kind: "key-value",
    pairs: [
      { key: "Moisture data", value: fmtDateTime(m.summary.moistureObservedAt) },
      { key: "Weather data", value: fmtDateTime(m.summary.weatherObservedAt) },
      {
        key: "Field location",
        value: `${fmt(m.field.labelPoint[1], 5)}, ${fmt(m.field.labelPoint[0], 5)}`,
      },
      { key: "Report date", value: fmtDate(m.reportDate) },
    ],
    columns: 2,
    marginTop: 4,
  });

  blocks.push({ kind: "spacer", height: 4 });
  blocks.push({
    kind: "text",
    style: "caption",
    text: "This report was generated by NocPulse and reflects conditions at the time of data collection. Always verify critical decisions with on-ground observation.",
  });

  return {
    artifactKey,
    title: `Field Report: ${m.field.name}`,
    subject: `NocPulse field report for ${m.field.name} — ${m.reportDate.slice(0, 10)}`,
    author: "NocPulse",
    blocks,
  };
}
