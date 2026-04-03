import type { PdfRenderInput, PdfBlock, PdfBrandLogo, RGB } from "@fieldpulse/pdf";
import { STATUS, BRAND, SURFACE } from "@fieldpulse/pdf";
import type { FieldAlert } from "@fieldpulse/module-alerts";
import { describeMoistureBandNarrative } from "@fieldpulse/module-moisture";
import {
  describeFieldAccessDecisionNarrative,
  describeSeedingAdvisoryNarrative,
  describeSprayWindowAdvisoryNarrative,
  prairieDefaultRulePack,
  resolveCropRuleContext,
  resolveFieldAccessDecision,
  resolveSeedingAdvisoryDecision,
  type FieldIntelligenceFinding,
  type FieldZoneActivityItem,
  type SeedingAdvisoryDecision,
} from "@fieldpulse/module-crop-intelligence";
import {
  describeDailyForecastCondition,
  describeFrostRiskNarrative,
  describeWeatherSignalNarrative,
  findSprayWindows,
  formatFieldLocalTime,
  summarizeForecastDays,
} from "@fieldpulse/module-weather";
import type { FieldReportReadModel } from "../contracts/FieldReportReadModel";
import {
  inferFieldAlertFollowUpAction,
  inferFieldFindingFollowUpAction,
} from "./inferReportFollowUpAction";

/* ═══════════════════════════════════════════════════════════════════
   NocPulse Field Report — PDF Document Builder  (v3)
   ───────────────────────────────────────────────────────────────────
   Colors now sourced from @fieldpulse/pdf PdfStyleSheet.
   Section headers use uniform styling — no per-section accent colors.
   ═══════════════════════════════════════════════════════════════════ */

type BuildFieldReportPdfRenderInput = {
  artifactKey: string;
  readModel: FieldReportReadModel;
  brandLogo?: PdfBrandLogo;
};

/* ── Palette aliases from stylesheet ── */

const GREEN: RGB = BRAND.forest900;
const GREEN_SOFT: RGB = BRAND.positive;
const RED: RGB = STATUS.critical;
const AMBER: RGB = STATUS.warning;
const TEAL: RGB = STATUS.info;
const SLATE: RGB = SURFACE.border;

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

/* ── Seeding Intelligence Helpers ── */

function buildPdfSeedingRecommendation(input: {
  decision: SeedingAdvisoryDecision;
  cropLabel: string;
  frostDamageTempC: number;
  surfaceMoistureMinPct: number;
  fieldAccessExplanation: string;
}): { severity: "critical" | "warning" | "info"; title: string; body: string; action: string } {
  const narrative = describeSeedingAdvisoryNarrative({
    decision: input.decision,
    cropLabel: input.cropLabel,
    frostDamageTempC: input.frostDamageTempC,
    surfaceMoistureMinPct: input.surfaceMoistureMinPct,
    fieldAccessExplanation: input.fieldAccessExplanation,
  });

  return {
    severity: narrative.pdfSeverity,
    title: narrative.pdfTitle,
    body: narrative.whyNow,
    action: narrative.pdfAction,
  };
}

/* ═══════════════════════════════════════════════════════════════════ */

export function buildFieldReportPdfRenderInput({
  artifactKey,
  readModel,
  brandLogo,
}: BuildFieldReportPdfRenderInput): PdfRenderInput {
  const blocks: PdfBlock[] = [];
  const m = readModel;
  const snap = m.moisture.latestSnapshot;
  const obs = m.weather.profile.latestObservation;
  const sig = m.weather.signals;
  const crop = m.cropContext;
  const cropType = crop?.cropType ?? m.summary.cropType ?? null;
  const growthStage = crop?.growthStage ?? m.summary.growthStage ?? null;
  const cropRuleContext = resolveCropRuleContext({
    rulePack: prairieDefaultRulePack,
    cropContext: {
      cropType,
      growthStage,
    },
  });
  const seedingThresholds = cropRuleContext.seedingThresholds;
  const frostThresholds = cropRuleContext.weatherRisk.frost;

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
        action: inferFieldAlertFollowUpAction(alert),
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

  blocks.push({ kind: "spacer", height: 6 });
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
    // Moisture cell-level summary table
    if (m.moisture.latestCells.length > 0) {
      const cells = m.moisture.latestCells;
      const highConf = cells.filter((c) => c.confidence === "high");
      const medConf = cells.filter((c) => c.confidence === "medium");
      const lowConf = cells.filter((c) => c.confidence === "low");
      const avgRoot = (arr: typeof cells) => arr.length > 0 ? arr.reduce((s, c) => s + c.rootZonePct, 0) / arr.length : null;
      const avgSurf = (arr: typeof cells) => arr.length > 0 ? arr.reduce((s, c) => s + c.surfacePct, 0) / arr.length : null;

      blocks.push({ kind: "spacer", height: 6 });
      blocks.push({
        kind: "text",
        style: "caption",
        text: `Cell-level moisture breakdown across ${cells.length} mapped cells:`,
      });

      const moistureRows: { cells: string[]; accentColor?: RGB }[] = [];
      if (highConf.length > 0) {
        moistureRows.push({
          cells: [
            "High",
            String(highConf.length),
            fmtPct(avgRoot(highConf)),
            fmtPct(avgSurf(highConf)),
            describeMoistureBandNarrative(avgRoot(highConf)),
          ],
        });
      }
      if (medConf.length > 0) {
        moistureRows.push({
          cells: [
            "Medium",
            String(medConf.length),
            fmtPct(avgRoot(medConf)),
            fmtPct(avgSurf(medConf)),
            describeMoistureBandNarrative(avgRoot(medConf)),
          ],
          accentColor: AMBER,
        });
      }
      if (lowConf.length > 0) {
        moistureRows.push({
          cells: [
            "Low",
            String(lowConf.length),
            fmtPct(avgRoot(lowConf)),
            fmtPct(avgSurf(lowConf)),
            "Low-confidence cells. Verify with in-field probe.",
          ],
          accentColor: RED,
        });
      }
      // Summary row
      moistureRows.push({
        cells: [
          "All Cells",
          String(cells.length),
          fmtPct(m.moisture.rootZoneAvgPct),
          fmtPct(m.moisture.surfaceAvgPct),
          `Range: ${fmtPct(m.moisture.rootZoneMinPct)} – ${fmtPct(m.moisture.rootZoneMaxPct)} root zone`,
        ],
      });

      blocks.push({
        kind: "table",
        columns: [
          { label: "Confidence", width: 0.14 },
          { label: "Cells", width: 0.10, align: "right" },
          { label: "Avg Root Zone", width: 0.16, align: "right" },
          { label: "Avg Surface", width: 0.16, align: "right" },
          { label: "Notes", width: 0.44 },
        ],
        headerBg: GREEN,
        rows: moistureRows,
        marginTop: 4,
      });
    }
  } else {
    blocks.push({
      kind: "text",
      style: "body",
      text: "No moisture data available for this report date. This usually means no satellite pass has been processed yet.",
    });
  }

  /* ── Weather Observations ── */

  blocks.push({ kind: "spacer", height: 6 });
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

  /* ── Derived Weather Signals Assessment ── */

  if (sig) {
    blocks.push({ kind: "spacer", height: 8 });
    blocks.push({
      kind: "section-header",
      label: "Weather Signal Assessment",
      meta: fmtDate(sig.observedAt),
      accentColor: GREEN,
    });

    // Build signal rows with thresholds and advisory notes
    const signalRows: { label: string; value: string; range: string; status: string; note: string; color?: RGB }[] = [
      {
        label: "Crop Water Demand (current)",
        value: `${fmt(sig.currentVpdKpa, 2)} kPa`,
        range: "0.4 – 1.5 kPa",
        status: sig.currentVpdKpa !== null && sig.currentVpdKpa < 0.4 ? "Low" : sig.currentVpdKpa !== null && sig.currentVpdKpa > 1.5 ? "High" : "OK",
        note: describeWeatherSignalNarrative("crop-water-demand", sig.currentVpdKpa),
        color: sig.currentVpdKpa !== null && (sig.currentVpdKpa < 0.4 || sig.currentVpdKpa > 1.5) ? AMBER : undefined,
      },
      {
        label: "Peak Crop Water Demand (24h)",
        value: `${fmt(sig.peakForecastVpdKpa24h, 2)} kPa`,
        range: "< 2.0 kPa",
        status: sig.peakForecastVpdKpa24h !== null && sig.peakForecastVpdKpa24h > 2.0 ? "High" : "OK",
        note: describeWeatherSignalNarrative("peak-vpd-24h", sig.peakForecastVpdKpa24h),
        color: sig.peakForecastVpdKpa24h !== null && sig.peakForecastVpdKpa24h > 2.0 ? RED : undefined,
      },
      {
        label: "Water Balance (24h)",
        value: `${fmt(sig.netWaterBalance24hMm, 1)} mm`,
        range: "> -5 mm",
        status: sig.netWaterBalance24hMm !== null && sig.netWaterBalance24hMm < -5 ? "Deficit" : sig.netWaterBalance24hMm !== null && sig.netWaterBalance24hMm < 0 ? "Mild" : "OK",
        note: describeWeatherSignalNarrative("water-balance-24h", sig.netWaterBalance24hMm),
        color: sig.netWaterBalance24hMm !== null && sig.netWaterBalance24hMm < -5 ? AMBER : undefined,
      },
      {
        label: "Water Balance (72h)",
        value: `${fmt(sig.netWaterBalance72hMm, 1)} mm`,
        range: "> -10 mm",
        status: sig.netWaterBalance72hMm !== null && sig.netWaterBalance72hMm < -10 ? "Deficit" : sig.netWaterBalance72hMm !== null && sig.netWaterBalance72hMm < -3 ? "Watch" : "OK",
        note: describeWeatherSignalNarrative("water-balance-72h", sig.netWaterBalance72hMm),
        color: sig.netWaterBalance72hMm !== null && sig.netWaterBalance72hMm < -10 ? RED : undefined,
      },
      {
        label: "Frost Risk Min",
        value: `${fmt(sig.frostRiskMinTempC)}°C`,
        range: "> 2°C",
        status: sig.frostRiskMinTempC !== null && sig.frostRiskMinTempC < 0 ? "Risk" : sig.frostRiskMinTempC !== null && sig.frostRiskMinTempC < 2 ? "Watch" : "OK",
        note: describeWeatherSignalNarrative("frost-risk", sig.frostRiskMinTempC),
        color: sig.frostRiskMinTempC !== null && sig.frostRiskMinTempC < 0 ? RED : undefined,
      },
      {
        label: "Leaf Wet Hours (24h)",
        value: `${sig.leafWetHours24h ?? "—"} h`,
        range: "< 6 h",
        status: sig.leafWetHours24h > 12 ? "High" : sig.leafWetHours24h > 6 ? "Watch" : "OK",
        note: describeWeatherSignalNarrative("leaf-wet-hours-24h", sig.leafWetHours24h),
        color: sig.leafWetHours24h > 12 ? AMBER : undefined,
      },
      {
        label: "Spray Windows (24h)",
        value: String(sig.sprayWindowCount24h ?? "—"),
        range: "> 2",
        status: sig.sprayWindowCount24h === 0 ? "None" : sig.sprayWindowCount24h < 2 ? "Limited" : "OK",
        note: describeWeatherSignalNarrative("spray-windows-24h", sig.sprayWindowCount24h),
        color: sig.sprayWindowCount24h === 0 ? AMBER : undefined,
      },
      {
        label: "GDD (72h)",
        value: fmt(sig.gdd72h, 1),
        range: "> 5",
        status: sig.gdd72h !== null && sig.gdd72h < 5 ? "Low" : "OK",
        note: describeWeatherSignalNarrative("gdd-72h", sig.gdd72h),
      },
    ];

    // Add soil temperature row if available
    if (sig.soilTemp6cmCurrentC !== null) {
      const soilThreshold = seedingThresholds.soilTempMinC;
      signalRows.push({
        label: "Soil Temp (6 cm)",
        value: `${fmt(sig.soilTemp6cmCurrentC)}°C`,
        range: `≥ ${soilThreshold}°C`,
        status: sig.soilTemp6cmCurrentC >= soilThreshold ? "OK" : sig.soilTemp6cmCurrentC >= soilThreshold - 2 ? "Watch" : "Cold",
        note: sig.soilTemp6cmCurrentC >= soilThreshold
          ? `Above ${soilThreshold}°C seeding minimum${sig.soilTemp6cmSustainedDays !== null ? ` (${sig.soilTemp6cmSustainedDays} days sustained)` : ""}.`
          : `Below seeding threshold. ${(crop?.cropType ?? "Crop")} needs sustained ≥${soilThreshold}°C at seed depth.`,
        color: sig.soilTemp6cmCurrentC < soilThreshold ? AMBER : undefined,
      });
    }

    blocks.push({
      kind: "table",
      columns: [
        { label: "Signal", width: 0.20 },
        { label: "Value", width: 0.13, align: "right" },
        { label: "Threshold", width: 0.13 },
        { label: "Status", width: 0.10 },
        { label: "Notes", width: 0.44 },
      ],
      headerBg: GREEN,
      rows: signalRows.map((r) => ({
        cells: [r.label, r.value, r.range, r.status, r.note],
        accentColor: r.color,
      })),
      marginTop: 6,
    });

    // Frost risk progress bar if relevant (visual emphasis)
    if (sig.frostRiskMinTempC !== null && sig.frostRiskMinTempC < 2) {
      blocks.push({
        kind: "progress-bar",
        label: "Frost Risk",
        value: `${fmt(sig.frostRiskMinTempC)}°C`,
        percent: Math.max(0, Math.min(100, ((sig.frostRiskMinTempC + 4) / 6) * 100)),
        fillColor: sig.frostRiskMinTempC < 0 ? RED : AMBER,
        rangeLabels: ["-4°C", ">-2°C"],
        marginTop: 4,
      });
    }

    /* ── Frost & Spring Risk (expanded) ── */

    const hasFrostDetail =
      sig.frostRiskMinTempC7d !== null ||
      sig.frostProbabilityPct7d !== null ||
      sig.frostRiskNights7d !== null ||
      sig.freezeThawCycles7d !== null;

    if (hasFrostDetail) {
      const frostNarrative = describeFrostRiskNarrative({
        minTempC: sig.frostRiskMinTempC7d,
        probabilityPct7d: sig.frostProbabilityPct7d,
        riskNights7d: sig.frostRiskNights7d,
      });

      blocks.push({ kind: "spacer", height: 6 });
      blocks.push({
        kind: "section-header",
        label: "Frost & Spring Risk",
        meta: "7-day outlook",
        accentColor: GREEN,
      });

      const frostMetrics: { label: string; value: string; sub?: string; valueColor?: RGB }[] = [];

      if (sig.frostRiskMinTempC7d !== null) {
        frostMetrics.push({
          label: "7-Day Low",
          value: `${fmt(sig.frostRiskMinTempC7d)}°C`,
          sub: frostNarrative.sevenDayLowSub,
          valueColor: sig.frostRiskMinTempC7d < 0 ? RED : sig.frostRiskMinTempC7d < 2 ? AMBER : undefined,
        });
      }

      if (sig.frostProbabilityPct7d !== null) {
        frostMetrics.push({
          label: "Frost Probability",
          value: `${fmt(sig.frostProbabilityPct7d, 0)}%`,
          sub: frostNarrative.probabilitySub,
          valueColor: sig.frostProbabilityPct7d > 60 ? RED : sig.frostProbabilityPct7d > 30 ? AMBER : undefined,
        });
      }

      if (sig.frostRiskNights7d !== null) {
        frostMetrics.push({
          label: "Frost-Risk Nights",
          value: `${sig.frostRiskNights7d} of 7`,
          sub: frostNarrative.riskNightsSub,
          valueColor: sig.frostRiskNights7d >= 4 ? RED : sig.frostRiskNights7d >= 2 ? AMBER : undefined,
        });
      }

      if (sig.freezeThawCycles7d !== null) {
        frostMetrics.push({
          label: "Freeze-Thaw Cycles",
          value: String(sig.freezeThawCycles7d),
          sub: sig.freezeThawCycles7d >= 3
            ? "Soil structure at risk — crusting possible after seeding"
            : sig.freezeThawCycles7d >= 1
              ? "Some soil heaving — monitor seedbed condition"
              : "Stable — no freeze-thaw disruption",
          valueColor: sig.freezeThawCycles7d >= 3 ? AMBER : undefined,
        });
      }

      blocks.push({
        kind: "metric-grid",
        cells: frostMetrics,
        columns: frostMetrics.length >= 4 ? 4 : frostMetrics.length as 2 | 3,
        marginTop: 6,
      });

      // 7-day frost probability progress bar
      if (sig.frostProbabilityPct7d !== null) {
        blocks.push({
          kind: "progress-bar",
          label: "7-Day Frost Probability",
          value: `${fmt(sig.frostProbabilityPct7d, 0)}%`,
          percent: sig.frostProbabilityPct7d,
          fillColor: sig.frostProbabilityPct7d > 60 ? RED : sig.frostProbabilityPct7d > 30 ? AMBER : GREEN_SOFT,
          rangeLabels: ["0%", "100%"],
          marginTop: 4,
        });
      }
    }

    /* ── Seeding Intelligence ── */

    const hasSoilTemp = sig.soilTemp6cmCurrentC !== null;
    const growthStageLabel = (growthStage ?? "").toLowerCase();
    const isPreSeed =
      !growthStageLabel ||
      growthStageLabel === "pre-seed" ||
      growthStageLabel.includes("pre");

    if (hasSoilTemp || isPreSeed) {
      blocks.push({ kind: "spacer", height: 6 });
      blocks.push({
        kind: "section-header",
        label: "Seeding Intelligence",
        meta: cropType ? `${cropType} — ${seedingThresholds.soilTempMinC}°C min` : "Spring assessment",
        accentColor: GREEN,
      });

      // Soil temperature metrics
      const seedMetrics: { label: string; value: string; sub?: string; valueColor?: RGB }[] = [];

      const threshold = seedingThresholds.soilTempMinC;
      if (sig.soilTemp6cmCurrentC !== null) {
        seedMetrics.push({
          label: "Soil Temp (6 cm)",
          value: `${fmt(sig.soilTemp6cmCurrentC)}°C`,
          sub: sig.soilTemp6cmCurrentC >= threshold
            ? `Above ${threshold}°C minimum for ${cropType ?? "seeding"}`
            : `Below ${threshold}°C — too cold for ${cropType ?? "seeding"}`,
          valueColor: sig.soilTemp6cmCurrentC < threshold ? RED : undefined,
        });
      }

      if (sig.soilTemp6cmSustainedDays !== null) {
        seedMetrics.push({
          label: "Days Sustained",
          value: `${sig.soilTemp6cmSustainedDays} day${sig.soilTemp6cmSustainedDays !== 1 ? "s" : ""}`,
          sub: sig.soilTemp6cmSustainedDays >= 3
            ? "3+ days above threshold — soil warming is stable"
            : "Need 3+ consecutive days above threshold",
          valueColor: sig.soilTemp6cmSustainedDays < 3 ? AMBER : undefined,
        });
      }

      // Field workability
      const accessDecision = resolveFieldAccessDecision({
        surfaceMoisturePct: snap?.surfacePct ?? null,
        recentPrecipTotal72hMm: sig.recentPrecipTotal72hMm,
        freezeThawCycles7d: sig.freezeThawCycles7d,
        thresholds: seedingThresholds,
      });
      const accessNarrative =
        accessDecision == null ? null : describeFieldAccessDecisionNarrative(accessDecision);
      seedMetrics.push({
        label: "Field Access",
        value: accessNarrative?.valueLabel ?? "—",
        sub: accessNarrative?.detailedExplanation ?? "Field access not available",
        valueColor:
          accessDecision?.verdict === "wait"
            ? RED
            : accessDecision?.verdict === "marginal"
              ? AMBER
              : undefined,
      });

      blocks.push({
        kind: "metric-grid",
        cells: seedMetrics,
        columns: seedMetrics.length >= 3 ? 3 : 2,
        marginTop: 6,
      });

      // Seeding recommendation — the hero element
      const seedingDecision = resolveSeedingAdvisoryDecision({
        seedingThresholds,
        frostThresholds,
        soilTemp6cmCurrentC: sig.soilTemp6cmCurrentC,
        soilTemp6cmSustainedDays: sig.soilTemp6cmSustainedDays,
        surfaceMoisturePct: snap?.surfacePct ?? null,
        fieldAccessVerdict: accessDecision?.verdict ?? null,
        frostRiskMinTempC7d: sig.frostRiskMinTempC7d,
        frostRiskNights7d: sig.frostRiskNights7d,
        frostProbabilityPct7d: sig.frostProbabilityPct7d,
      });
      if (seedingDecision) {
        const seedingCard = buildPdfSeedingRecommendation({
          decision: seedingDecision,
          cropLabel: cropType ?? "Crop",
          frostDamageTempC: frostThresholds.damageTempC,
          surfaceMoistureMinPct: seedingThresholds.surfaceMoistureMinPct,
          fieldAccessExplanation:
            accessDecision == null
              ? "Field access conditions are not yet available."
              : accessNarrative?.detailedExplanation ?? "Field access conditions are not yet available.",
        });

        blocks.push({
          kind: "severity-card",
          severity: seedingCard.severity,
          title: seedingCard.title,
          body: seedingCard.body,
          action: seedingCard.action,
          marginTop: 6,
        });
      }

      // Soil temp progress bar
      if (sig.soilTemp6cmCurrentC !== null) {
        blocks.push({
          kind: "progress-bar",
          label: `Soil Temperature vs ${threshold}°C Seeding Minimum`,
          value: `${fmt(sig.soilTemp6cmCurrentC)}°C`,
          percent: Math.max(0, Math.min(100, (sig.soilTemp6cmCurrentC / (threshold * 2)) * 100)),
          fillColor: sig.soilTemp6cmCurrentC >= threshold ? GREEN_SOFT : RED,
          rangeLabels: ["0°C", `${threshold * 2}°C`],
          marginTop: 4,
        });
      }
    }

    /* ── GDD Accumulation ── */

    const cumulativeGdd = crop?.accumulatedGdd ?? null;
    const hasGddData = cumulativeGdd !== null || sig.gdd24h !== null;

    if (hasGddData) {
      blocks.push({ kind: "spacer", height: 6 });
      blocks.push({
        kind: "section-header",
        label: "Growing Degree Days",
        meta: crop?.lastGddObservedOn ? `Since ${fmtDate(crop.lastGddObservedOn)}` : "Season tracker",
        accentColor: GREEN,
      });

      const gddCells: { label: string; value: string; sub?: string; valueColor?: RGB }[] = [];

      if (cumulativeGdd !== null) {
        gddCells.push({
          label: "Season Total",
          value: fmt(cumulativeGdd, 0),
          sub: cumulativeGdd < 100
            ? "Early season — emergence stage for most crops"
            : cumulativeGdd < 400
              ? "Vegetative growth phase"
              : cumulativeGdd < 800
                ? "Reproductive phase approaching"
                : "Late-season maturation",
        });
      }

      if (sig.gdd24h !== null) {
        gddCells.push({
          label: "Last 24 h",
          value: fmt(sig.gdd24h, 1),
          sub: sig.gdd24h < 2 ? "Near-zero accumulation — cold stall" : "Active accumulation",
          valueColor: sig.gdd24h < 2 ? AMBER : undefined,
        });
      }

      if (sig.gdd72h !== null) {
        gddCells.push({
          label: "Last 72 h",
          value: fmt(sig.gdd72h, 1),
          sub: sig.gdd72h < 5 ? "Minimal heat units — growth essentially paused" : `${fmt(sig.gdd72h / 3, 1)} avg/day`,
          valueColor: sig.gdd72h < 5 ? AMBER : undefined,
        });
      }

      gddCells.push({
        label: "Base Temp",
        value: `${fmt(sig.gddBaseC, 0)}°C`,
        sub: `GDD = max(0, avg daily temp − ${fmt(sig.gddBaseC, 0)}°C)`,
      });

      blocks.push({
        kind: "metric-grid",
        cells: gddCells,
        columns: gddCells.length >= 4 ? 4 : gddCells.length as 2 | 3,
        marginTop: 6,
      });

      // GDD season progress bar (rough: 1200 GDD typical canola season)
      if (cumulativeGdd !== null) {
        const seasonTarget = cropType?.toLowerCase().includes("canola") ? 1200 : 1400;
        blocks.push({
          kind: "progress-bar",
          label: "Season GDD Progress",
          value: `${fmt(cumulativeGdd, 0)} / ~${seasonTarget}`,
          percent: Math.min(100, (cumulativeGdd / seasonTarget) * 100),
          fillColor: GREEN_SOFT,
          rangeLabels: ["0", String(seasonTarget)],
          marginTop: 4,
        });
      }
    }
  }

  /* ── Spray Window Detail ── */

  const allForecasts = m.weather.profile.forecasts;
  const sprayWindows =
    allForecasts.length >= 4
      ? findSprayWindows(allForecasts, {
          horizonHours: 48,
          maxWindows: 3,
          consecutiveHours: 4,
        })
      : [];

  if (sprayWindows.length > 0 || (sig && sig.sprayWindowCount24h > 0)) {
    blocks.push({ kind: "spacer", height: 6 });
    blocks.push({
      kind: "section-header",
      label: "Spray Windows",
      meta: sprayWindows.length > 0
        ? `${sprayWindows.length} window${sprayWindows.length > 1 ? "s" : ""} in next 48 h`
        : `${sig?.sprayWindowCount24h ?? 0} eligible in 24 h`,
      accentColor: GREEN,
    });

    if (sprayWindows.length > 0) {
      blocks.push({
        kind: "text",
        style: "caption",
        text: "Eligible 4-hour blocks where wind ≤ 18 km/h, rain probability < 20%, precipitation < 1 mm, and average temperature 10–30°C. All times shown in field-local time.",
      });

      blocks.push({
        kind: "table",
        columns: [
          { label: "Window", width: 0.08, align: "center" },
          { label: "Start", width: 0.22 },
          { label: "End", width: 0.22 },
          { label: "Max Wind", width: 0.16, align: "right" },
          { label: "Rain Risk", width: 0.16, align: "right" },
          { label: "Temp Range", width: 0.16, align: "right" },
        ],
        headerBg: GREEN,
        rows: sprayWindows.map((w, i) => ({
          cells: [
            String(i + 1),
            formatFieldLocalTime(w.startAt, {
              fieldTimeZone: m.fieldTimeZone,
              fieldLabelPoint: m.field.labelPoint,
            }),
            formatFieldLocalTime(w.endAt, {
              fieldTimeZone: m.fieldTimeZone,
              fieldLabelPoint: m.field.labelPoint,
            }),
            `${Math.round(w.maxWindKph)} km/h`,
            w.maxPrecipProbabilityPct !== null ? `${Math.round(w.maxPrecipProbabilityPct)}%` : "Low",
            `${w.minAverageTempC.toFixed(0)}–${w.maxAverageTempC.toFixed(0)}°C`,
          ],
        })),
        marginTop: 6,
      });

      const best = sprayWindows[0]!;
      const bestStartLabel = formatFieldLocalTime(best.startAt, {
        fieldTimeZone: m.fieldTimeZone,
        fieldLabelPoint: m.field.labelPoint,
      });
      const bestEndLabel = formatFieldLocalTime(best.endAt, {
        fieldTimeZone: m.fieldTimeZone,
        fieldLabelPoint: m.field.labelPoint,
      });
      const sprayNarrative = describeSprayWindowAdvisoryNarrative({
        cropLabel: cropType ?? "This crop",
        sprayWindowCount24h: sig?.sprayWindowCount24h ?? sprayWindows.length,
        firstWindow: best,
        startLabel: bestStartLabel,
        endLabel: bestEndLabel,
      });
      blocks.push({
        kind: "severity-card",
        severity: "info",
        title: sprayNarrative.pdfCardTitle,
        body: sprayNarrative.pdfBody,
        action: sprayNarrative.pdfAction,
        marginTop: 6,
      });
    } else {
      blocks.push({
        kind: "text",
        style: "body",
        text: `${sig?.sprayWindowCount24h ?? 0} spray-eligible period${(sig?.sprayWindowCount24h ?? 0) !== 1 ? "s" : ""} detected in the next 24 hours, but detailed hourly forecast data was insufficient to identify specific window times. Check hourly conditions before spraying.`,
      });
    }
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     PAGE 3 — FORECAST
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

  const forecastDays = summarizeForecastDays(m.weather.profile.forecasts, {
    fieldTimeZone: m.fieldTimeZone,
    fieldLabelPoint: m.field.labelPoint,
    limitDays: 7,
  });
  if (forecastDays.length > 0) {
    blocks.push({ kind: "spacer", height: 6 });
    blocks.push({
      kind: "section-header",
      label: "Forecast",
      meta: `Next ${forecastDays.length} day${forecastDays.length === 1 ? "" : "s"}`,
      accentColor: GREEN,
    });

    blocks.push({
      kind: "table",
      columns: [
        { label: "Day", width: 0.18 },
        { label: "Conditions", width: 0.16 },
        { label: "Min", width: 0.09, align: "right" },
        { label: "Max", width: 0.09, align: "right" },
        { label: "Precip", width: 0.14, align: "right" },
        { label: "Wind", width: 0.14, align: "right" },
        { label: "Chance", width: 0.12, align: "right" },
      ],
      headerBg: GREEN,
      rows: forecastDays.map((f) => ({
        cells: [
          f.label,
          describeDailyForecastCondition(f),
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
    const precipValues = forecastDays
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
    const tempHighs = forecastDays
      .map((f) => f.airTemperatureMaxC)
      .filter((v): v is number => v !== null);
    const tempLows = forecastDays
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

  blocks.push({ kind: "spacer", height: 6 });
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
        action: inferFieldAlertFollowUpAction(alert),
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
    blocks.push({ kind: "spacer", height: 6 });
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
        action: inferFieldFindingFollowUpAction(finding),
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
    blocks.push({ kind: "spacer", height: 6 });
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

  blocks.push({ kind: "spacer", height: 8 });
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
    brandLogo,
    blocks,
  };
}
