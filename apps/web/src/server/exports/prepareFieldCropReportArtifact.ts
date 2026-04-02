import { renderPdfDocument, type PdfBlock, type PdfRenderInput, type RGB } from "@fieldpulse/pdf";
import type { FieldCropProps } from "../../features/fields/tabs/CropTab";
import type { FieldSummaryProps } from "../../components/panels/SummaryTab";
import { loadPdfBrandLogo } from "./loadPdfBrandLogo";

/* ═══════════════════════════════════════════════════════════════════
   Crop Detail Report — Branded PDF Artifact
   ───────────────────────────────────────────────────────────────────
   Produces a visual NocPulse-branded PDF from the same view-model
   data that drives the Crop tab: health/moisture donuts, thresholds,
   disease risk cards, growth progression, and field context tiles.
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
const SLATE: RGB = [0.42, 0.44, 0.47];

function hexToRgb(hex: string): RGB | undefined {
  const c = hex.replace("#", "");
  if (c.length !== 6) return undefined;
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  if (Number.isNaN(r)) return undefined;
  return [r, g, b];
}

function thresholdSeverity(status: string): "critical" | "warning" | "info" {
  return status === "danger" ? "critical" : status === "warn" ? "warning" : "info";
}

function joinParts(parts: Array<string | null | undefined>, separator = " · "): string | undefined {
  const compact = parts.map((part) => part?.trim()).filter((part): part is string => Boolean(part));
  return compact.length > 0 ? compact.join(separator) : undefined;
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

function deriveTruthSource(summary: FieldSummaryProps): string | undefined {
  if (summary.sourceTagExtended?.trim()) return summary.sourceTagExtended.trim();
  if (summary.moistureDerivationMode === "source-backed") {
    return joinParts(["Satellite-derived", summary.confidenceSub !== "No source" ? summary.confidenceSub : undefined]);
  }
  if (summary.moistureDerivationMode && summary.moistureDerivationMode !== "unknown") {
    return joinParts(["Modeled estimate", summary.confidenceSub !== "No source" ? summary.confidenceSub : undefined]);
  }
  return undefined;
}

/** Derive a plain-language action for a disease risk card. */
function inferDiseaseAction(
  name: string,
  sev: "critical" | "warning" | "info",
): string | undefined {
  const n = name.toLowerCase();
  if (sev === "info") return undefined; // No action needed for low risk
  if (n.includes("sclerotinia"))
    return "Scout canopy for sclerotinia symptoms. Consult agronomist on fungicide timing if at petal stage.";
  if (n.includes("fusarium"))
    return "Monitor heads for fusarium symptoms. Consider fungicide if heading stage and conditions persist.";
  if (n.includes("rust") || n.includes("stripe"))
    return "Scout lower canopy for rust pustules. Apply foliar fungicide if spread is confirmed.";
  if (n.includes("blackleg"))
    return "Inspect stem bases for lesions. Plan resistant variety selection for next rotation.";
  if (n.includes("clubroot"))
    return "Avoid equipment movement from affected areas. Use resistant cultivars in future rotations.";
  if (sev === "critical")
    return "Scout affected areas immediately. Consult agronomist for treatment options.";
  return "Monitor for symptoms. Scout during next field walk.";
}

/** Derive an action for crop alert severity cards. */
function inferCropAlertAction(title: string): string | undefined {
  const t = title.toLowerCase();
  if (t.includes("frost")) return "Consider frost protection measures. Monitor overnight lows closely.";
  if (t.includes("moisture stress")) return "Schedule irrigation check. Prioritize affected zones.";
  if (t.includes("hail")) return "Review hail protection options. Check crop insurance coverage.";
  if (t.includes("wind")) return "Assess wind damage risk. Delay spraying until conditions settle.";
  if (t.includes("disease")) return "Scout affected areas. Consult agronomist for fungicide options.";
  if (t.includes("vpd") || t.includes("atmospheric")) return "Monitor crop water demand. Consider irrigation timing.";
  return undefined;
}

/* ── Export types ── */

export type PrepareFieldCropReportArtifactInput = {
  fieldId: string;
  fieldName: string;
  areaLabel: string;
  crop: FieldCropProps | null;
  summary: FieldSummaryProps | null;
  generatedAt?: string;
};

export type PreparedFieldCropReportArtifact = {
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

function buildBlocks(input: PrepareFieldCropReportArtifactInput): PdfBlock[] {
  const blocks: PdfBlock[] = [];
  const c = input.crop;
  const s = input.summary;
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const cropName = c?.cropName ?? s?.crop ?? "n/a";
  const stageLabel = s?.cropStage ?? c?.thresholdStageLabel ?? "Stage unavailable";

  /* ━━ COVER ━━ */

  blocks.push({ kind: "text", style: "title", text: `${input.fieldName} — Crop Report` });
  blocks.push({
    kind: "text",
    style: "caption",
    text: `${cropName} · ${stageLabel} · ${generatedAt.slice(0, 10)}`,
  });

  // Health status badge derived from crop health donut
  if (c) {
    const healthPct = c.healthIndex.value;
    const ok = healthPct >= 70;
    blocks.push({
      kind: "status-badge",
      label: c.healthIndex.label,
      color: ok ? TEAL : healthPct >= 40 ? AMBER : RED,
      marginTop: 6,
    });
  }

  // Field identity
  blocks.push({
    kind: "key-value",
    pairs: [
      { key: "Crop", value: cropName },
      { key: "Stage", value: stageLabel },
      { key: "Area", value: input.areaLabel },
      { key: "LLD", value: c?.lld ?? "—" },
      { key: "Accumulated GDD", value: c?.accumulatedGddLabel ?? "—" },
      { key: "GDD Unit", value: c?.gddUnitLabel ?? "—" },
    ],
    columns: 2,
    marginTop: 8,
  });

  if (c) {
    blocks.push({
      kind: "metric-strip",
      cells: [
        { label: "Health", value: c.healthIndex.label, valueColor: hexToRgb(c.healthIndex.fillColor) ?? GREEN },
        { label: "Moisture", value: c.moistureBalance.label, valueColor: hexToRgb(c.moistureBalance.fillColor) ?? AMBER },
        { label: "Alerts", value: String(c.alerts.length), valueColor: c.alerts.length > 0 ? RED : TEAL },
        { label: "Disease Risks", value: String(c.diseaseRisks.length), valueColor: c.diseaseRisks.length > 0 ? AMBER : TEAL },
      ],
      marginTop: 6,
    });

    blocks.push({
      kind: "text",
      style: "caption",
      text: `Generated from the current FDP crop model, including growth stage, crop health, moisture balance, active alerts, threshold assessments, and provenance.`,
    });
  }

  /* ━━ TRUTH & FRESHNESS ━━ */

  if (s && (s.dataQuality || s.confidenceBreakdown || s.sourceTagExtended || s.historicalAnomaly || s.dataSources)) {
    const sourceSummary = deriveTruthSource(s);
    const heldBack = s.dataQuality?.label && s.dataQuality.label !== "Ready";

    blocks.push({
      kind: "section-header",
      label: "Truth & Freshness",
      meta: s.updatedLabel,
      accentColor: dataQualityColor(s),
    });

    if (s.dataQuality) {
      blocks.push({
        kind: "status-badge",
        label: `${s.dataQuality.label} Context`,
        color: dataQualityColor(s),
        marginTop: 4,
      });
      blocks.push({
        kind: "text",
        style: "body",
        text:
          joinParts([s.dataQuality.summary, heldBack ? "Crop-specific signals may be held back until field context is stronger." : undefined], " ") ??
          s.dataQuality.summary,
      });
    }

    blocks.push({
      kind: "key-value",
      pairs: [
        { key: "Moisture source", value: sourceSummary ?? "Unavailable" },
        { key: "Confidence", value: joinParts([s.confidence, s.confidenceSub]) ?? s.confidence },
        ...(s.historicalAnomaly?.description
          ? [{ key: "Historical signal", value: s.historicalAnomaly.description }]
          : []),
      ],
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

  /* ━━ GROWTH PROGRESSION ━━ */

  if (c && c.growthSegments.length > 0) {
    blocks.push({
      kind: "section-header",
      label: "Growth Progression",
      meta: stageLabel,
    });

    blocks.push({
      kind: "metric-strip",
      cells: c.growthSegments.map((seg) => ({
        label: seg.active ? `▶ ${seg.label}` : seg.label,
        value: seg.active ? "Active" : "—",
        valueColor: seg.active ? TEAL : undefined,
      })),
      marginTop: 4,
    });

    // GDD accumulation progress bar
    if (c.accumulatedGddLabel && c.accumulatedGddLabel !== "—") {
      const gddNum = parseFloat(c.accumulatedGddLabel);
      // Typical crop GDD targets vary, but use a reasonable scale
      const gddPct = !Number.isNaN(gddNum) ? Math.min(100, Math.max(0, (gddNum / 2000) * 100)) : 0;
      blocks.push({
        kind: "progress-bar",
        label: `GDD Accumulation (${c.gddUnitLabel})`,
        value: c.accumulatedGddLabel,
        percent: gddPct,
        fillColor: gddPct >= 80 ? AMBER : TEAL,
        rangeLabels: ["0", "2000"],
        marginTop: 6,
      });
    }
  }

  /* ━━ CROP SIGNAL SUMMARY ━━ */

  if (c) {
    blocks.push({
      kind: "section-header",
      label: "Recent Weather Pressure",
      meta: s?.nextRain ? `Next rain ${s.nextRain}` : undefined,
      accentColor: GREEN,
    });

    blocks.push({
      kind: "metric-grid",
      cells: [
        ...(c.fieldTiles.slice(0, 4).map((tile) => ({
          label: tile.label,
          value: tile.value,
          sub: tile.sub,
          valueColor: hexToRgb(tile.valueColor),
        }))),
      ],
      columns: c.fieldTiles.length <= 3 ? 3 : 4,
      marginTop: 4,
    });

    if (s) {
      const trendValue = s.trend ?? "—";
      blocks.push({
        kind: "metric-strip",
        cells: [
          { label: "Trend (7d)", value: trendValue, valueColor: trendValue.startsWith("-") ? AMBER : undefined },
          { label: "Precipitation", value: s.precipitation ?? "—" },
          { label: "Rain Chance", value: s.rainChance ?? "—" },
          { label: "7-Day Total", value: s.sevenDayTotal ?? "—" },
        ],
        marginTop: 6,
      });
    }

    blocks.push({
      kind: "section-header",
      label: "Crop Signals",
      accentColor: GREEN,
    });

    blocks.push({
      kind: "metric-grid",
      cells: [
        {
          label: c.healthIndexTitle,
          value: c.healthIndex.label,
          sub: c.healthIndex.subLabel,
          valueColor: hexToRgb(c.healthIndex.fillColor),
        },
        {
          label: c.moistureBalanceTitle,
          value: c.moistureBalance.label,
          sub: c.moistureBalance.subLabel,
          valueColor: hexToRgb(c.moistureBalance.fillColor),
        },
        {
          label: "Accumulated GDD",
          value: c.accumulatedGddLabel,
          sub: c.gddUnitLabel,
        },
      ],
      columns: 3,
      marginTop: 4,
    });

    /* ── Health index metrics ── */

    if (c.healthIndex.metrics.length > 0) {
      blocks.push({
        kind: "section-header",
        label: "Health Index Metrics",
        meta: c.healthIndex.label,
      });

      blocks.push({
        kind: "metric-grid",
        cells: c.healthIndex.metrics.map((m) => ({
          label: m.label,
          value: m.value,
          valueColor: hexToRgb(m.valueColor),
        })),
        columns: c.healthIndex.metrics.length <= 3 ? 3 : 4,
        marginTop: 4,
      });
    }

    /* ── Moisture balance metrics ── */

    if (c.moistureBalance.metrics.length > 0) {
      blocks.push({
        kind: "section-header",
        label: "Moisture Balance Metrics",
        meta: c.moistureBalance.label,
      });

      blocks.push({
        kind: "metric-grid",
        cells: c.moistureBalance.metrics.map((m) => ({
          label: m.label,
          value: m.value,
          valueColor: hexToRgb(m.valueColor),
        })),
        columns: c.moistureBalance.metrics.length <= 3 ? 3 : 4,
        marginTop: 4,
      });
    }
  }

  /* ━━ CROP THRESHOLDS ━━ */

  if (c && c.thresholds.length > 0) {
    blocks.push({
      kind: "section-header",
      label: "Crop Thresholds — Expected vs Obtained",
      meta: c.thresholdStageLabel,
    });

    blocks.push({
      kind: "text",
      style: "caption",
      text: "Comparing current measured values against the acceptable range for this crop and growth stage. Action notes provided for any parameters outside optimal bounds.",
    });

    blocks.push({
      kind: "table",
      columns: [
        { label: "Parameter", width: 0.20 },
        { label: "Min", width: 0.08, align: "center" },
        { label: "Optimal", width: 0.14, align: "center" },
        { label: "Max", width: 0.08, align: "center" },
        { label: "Obtained", width: 0.12, align: "center" },
        { label: "Status", width: 0.10, align: "center" },
        { label: "Notes", width: 0.28 },
      ],
      headerBg: GREEN,
      rows: c.thresholds.map((t) => ({
        cells: [
          t.param,
          t.min,
          t.optimal,
          t.max,
          t.actual,
          t.status.toUpperCase(),
          t.notes,
        ],
        accentColor:
          t.status === "danger" ? RED : t.status === "warn" ? AMBER : undefined,
      })),
      marginTop: 4,
    });
  }

  /* ━━ FIELD CONTEXT ━━ */

  if (c && c.fieldTiles.length > 0) {
    blocks.push({
      kind: "section-header",
      label: "Field Context",
    });

    blocks.push({
      kind: "metric-grid",
      cells: c.fieldTiles.map((tile) => ({
        label: tile.label,
        value: tile.value,
        sub: tile.sub,
        valueColor: hexToRgb(tile.valueColor),
      })),
      columns: c.fieldTiles.length <= 3 ? 3 : 4,
      marginTop: 4,
    });
  }

  /* ━━ DISEASE RISKS ━━ */

  if (c && c.diseaseRisks.length > 0) {
    blocks.push({
      kind: "section-header",
      label: "Disease Risk Assessment",
      meta: `${c.diseaseRisks.length} tracked`,
      accentColor: AMBER,
    });

    for (const risk of c.diseaseRisks) {
      const pctNum = parseFloat(risk.pct);
      const sev: "critical" | "warning" | "info" =
        !Number.isNaN(pctNum) && pctNum >= 60
          ? "critical"
          : !Number.isNaN(pctNum) && pctNum >= 30
            ? "warning"
            : "info";

      // Derive action text: prefer explicit recommendedAction, fall back to heuristic
      const action =
        risk.recommendedAction ??
        inferDiseaseAction(risk.name, sev);

      blocks.push({
        kind: "severity-card",
        severity: sev,
        title: `${risk.name} — ${risk.pct}`,
        body: risk.desc,
        action,
        marginTop: 4,
      });
    }
  }

  /* ━━ ACTIVE ALERTS ━━ */

  const alertCount = c?.alerts.length ?? 0;
  blocks.push({
    kind: "section-header",
    label: "Active Crop Alerts",
    meta: `${alertCount} active`,
    accentColor: alertCount > 0 ? RED : GREEN,
  });

  if (!c || alertCount === 0) {
    blocks.push({
      kind: "text",
      style: "body",
      text: "No active crop alerts. All monitored parameters are within expected thresholds.",
    });
  } else {
    for (const alert of c.alerts.slice(0, 10)) {
      const sev: "critical" | "warning" | "info" =
        alert.iconKey === "disease" || alert.iconKey === "temperature"
          ? "critical"
          : alert.iconKey === "moisture"
            ? "warning"
            : "info";

      const action = inferCropAlertAction(alert.title);

      blocks.push({
        kind: "severity-card",
        severity: sev,
        title: alert.title,
        body: alert.desc,
        action,
        marginTop: 4,
      });
    }
  }

  /* ━━ PROVENANCE ━━ */

  blocks.push({ kind: "divider", marginTop: 16 });

  if (c && c.provenanceRows.length > 0) {
    const heldBack = s?.dataQuality?.label && s.dataQuality.label !== "Ready";
    if (heldBack) {
      blocks.push({
        kind: "text",
        style: "caption",
        text: `Crop interpretation is currently constrained by ${s?.dataQuality?.label?.toLowerCase()} field context. Provenance is included so the reader can see which signals are source-backed versus held back.`,
      });
    }
    blocks.push({
      kind: "key-value",
      pairs: c.provenanceRows.map((row) => ({
        key: row.key,
        value: row.value,
      })),
      columns: 2,
      marginTop: 4,
    });
  }

  if (c && c.provenanceChips.length > 0) {
    blocks.push({
      kind: "text",
      style: "caption",
      text: `Sources: ${c.provenanceChips.join(" · ")}`,
    });
  }

  if (c?.footer) {
    blocks.push({ kind: "text", style: "caption", text: c.footer });
  }

  blocks.push({
    kind: "text",
    style: "caption",
    text: "This report was generated by NocPulse and reflects conditions at the time of data collection. Verify critical decisions with on-ground observation.",
  });

  return blocks;
}

/* ── Public API ── */

export function prepareFieldCropReportArtifact(
  input: PrepareFieldCropReportArtifactInput,
): PreparedFieldCropReportArtifact {
  const blocks = buildBlocks(input);
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const now = generatedAt.slice(0, 10);
  const brandLogo = loadPdfBrandLogo();

  const renderInput: PdfRenderInput = {
    artifactKey: `crop-reports/${slugify(input.fieldName)}/${now}.pdf`,
    title: `${input.fieldName} Crop Report`,
    subject: `Crop report for ${input.fieldName}`,
    author: "NocPulse",
    brandLogo: brandLogo ? { format: "png", bytes: brandLogo } : undefined,
    blocks,
  };

  const result = renderPdfDocument(renderInput);
  const fileName = `${slugify(input.fieldName)}-crop-report-${now}.pdf`;

  return {
    bytes: result.bytes,
    contentType: "application/pdf",
    cacheControl: "private, max-age=0, no-cache",
    fileName,
    metadata: result.metadata,
  };
}
