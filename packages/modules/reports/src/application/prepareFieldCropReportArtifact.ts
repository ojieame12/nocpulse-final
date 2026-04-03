import { renderPdfDocument, type PdfBlock, type PdfRenderInput, type RGB } from "@fieldpulse/pdf";
import {
  describeAgronomicTruthBasis,
  formatAgronomicSourceBasisLabel,
} from "@fieldpulse/module-crop-intelligence";
import {
  inferCropAlertFollowUpAction,
  inferDiseaseRiskFollowUpAction,
} from "./inferReportFollowUpAction";
import {
  inferCropAlertSeverity,
  inferCropDiseaseRiskSeverity,
} from "./reportSeverity";
import { formatReportDateStamp } from "./reportFormat";

export type CropReportGrowthSegment = {
  label: string;
  active: boolean;
  color?: string | null;
};

export type CropReportThreshold = {
  param: string;
  min: string;
  optimal: string;
  max: string;
  actual: string;
  notes: string;
  status: "ok" | "warn" | "danger";
};

export type CropReportMetric = {
  label: string;
  value: string;
  valueColor?: string | null;
};

export type CropReportSignalGroup = {
  value: number;
  label: string;
  subLabel?: string | null;
  fillColor: string;
  metrics: readonly CropReportMetric[];
};

export type CropReportFieldTile = {
  label: string;
  value: string;
  sub?: string | null;
  valueColor?: string | null;
  bg?: string | null;
  border?: string | null;
};

export type CropReportDiseaseRisk = {
  name: string;
  desc: string;
  pct: string;
  color?: string | null;
  bg?: string | null;
  recommendedAction?: string | null;
};

export type CropReportAlert = {
  iconKey: string;
  iconColor?: string | null;
  bg?: string | null;
  title: string;
  desc: string;
};

export type CropReportProvenanceRow = {
  key: string;
  value: string;
};

export type FieldCropReportProps = {
  cropName: string;
  lld?: string | null;
  growthSegments: readonly CropReportGrowthSegment[];
  accumulatedGddLabel: string;
  gddUnitLabel: string;
  thresholdStageLabel: string;
  thresholds: readonly CropReportThreshold[];
  healthIndexTitle: string;
  healthIndex: CropReportSignalGroup;
  moistureBalanceTitle: string;
  moistureBalance: CropReportSignalGroup;
  fieldTiles: readonly CropReportFieldTile[];
  diseaseRisks: readonly CropReportDiseaseRisk[];
  provenanceLabel?: string | null;
  provenanceRows: readonly CropReportProvenanceRow[];
  provenanceChips: readonly string[];
  alerts: readonly CropReportAlert[];
  footer?: string | null;
};

export type CropReportConfidenceBreakdown = {
  freshness: string;
  agreement: string;
  resolution: string;
  scaleFit: string;
};

export type CropReportDataSources = {
  satellite?: string | null;
  weather?: string | null;
  soil?: string | null;
};

export type CropReportDataQuality = {
  label: string;
  tone: "positive" | "warning" | "danger" | string;
  summary: string;
};

export type FieldCropReportSummary = {
  crop?: string | null;
  cropStage?: string | null;
  updatedLabel?: string | null;
  sourceTagExtended?: string | null;
  moistureDerivationMode?: string | null;
  confidence?: string | null;
  confidenceSub?: string | null;
  historicalAnomaly?: {
    description?: string | null;
  } | null;
  confidenceBreakdown?: CropReportConfidenceBreakdown | null;
  dataSources?: CropReportDataSources | null;
  dataQuality?: CropReportDataQuality | null;
  nextRain?: string | null;
  trend?: string | null;
  precipitation?: string | null;
  rainChance?: string | null;
  sevenDayTotal?: string | null;
};

export type PrepareFieldCropReportArtifactInput = {
  fieldId: string;
  fieldName: string;
  areaLabel: string;
  crop: FieldCropReportProps | null;
  summary: FieldCropReportSummary | null;
  generatedAt?: string;
  brandLogoPngBytes?: Uint8Array;
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

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const GREEN: RGB = [0.08, 0.24, 0.17];
const RED: RGB = [0.93, 0.27, 0.27];
const AMBER: RGB = [0.96, 0.62, 0.04];
const TEAL: RGB = [0.09, 0.64, 0.29];
const SLATE: RGB = [0.42, 0.44, 0.47];

function hexToRgb(hex: string) {
  const c = hex.replace("#", "");
  if (c.length !== 6) return undefined;
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return undefined;
  return [r, g, b] as RGB;
}

function joinParts(parts: Array<string | null | undefined>, separator = " · ") {
  const compact = parts.map((part) => part?.trim()).filter((part): part is string => Boolean(part));
  return compact.length > 0 ? compact.join(separator) : undefined;
}

function dataQualityColor(summary: FieldCropReportSummary | null | undefined): RGB {
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

function deriveTruthSource(summary: FieldCropReportSummary): string | undefined {
  return describeAgronomicTruthBasis({
    sourceTagExtended: summary.sourceTagExtended,
    derivationMode: summary.moistureDerivationMode,
    confidenceSub: summary.confidenceSub,
  });
}

function buildBlocks(input: PrepareFieldCropReportArtifactInput): PdfBlock[] {
  const blocks: PdfBlock[] = [];
  const c = input.crop;
  const s = input.summary;
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const cropName = c?.cropName ?? s?.crop ?? "n/a";
  const stageLabel = s?.cropStage ?? c?.thresholdStageLabel ?? "Stage unavailable";

  blocks.push({ kind: "text", style: "title", text: `${input.fieldName} — Crop Report` });
  blocks.push({
    kind: "text",
    style: "caption",
    text: `${cropName} · ${stageLabel} · ${formatReportDateStamp(generatedAt)}`,
  });

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
      text: "Generated from the current FDP crop model, including growth stage, crop health, moisture balance, active alerts, threshold assessments, and provenance.",
    });
  }

  if (s && (s.dataQuality || s.confidenceBreakdown || s.sourceTagExtended || s.historicalAnomaly || s.dataSources)) {
    const sourceSummary = deriveTruthSource(s);
    const heldBack = s.dataQuality?.label && s.dataQuality.label !== "Ready";

    blocks.push({
      kind: "section-header",
      label: "Truth & Freshness",
      meta: s.updatedLabel ?? undefined,
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
        { key: "Confidence", value: joinParts([s.confidence, s.confidenceSub]) ?? s.confidence ?? "Unavailable" },
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

    if (c.accumulatedGddLabel && c.accumulatedGddLabel !== "—") {
      const gddNum = parseFloat(c.accumulatedGddLabel);
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

  if (c) {
    blocks.push({
      kind: "section-header",
      label: "Recent Weather Pressure",
      meta: s?.nextRain ? `Next rain ${s.nextRain}` : undefined,
      accentColor: GREEN,
    });

    blocks.push({
      kind: "metric-grid",
      cells: c.fieldTiles.slice(0, 4).map((tile) => ({
        label: tile.label,
        value: tile.value,
        sub: tile.sub ?? undefined,
        valueColor: hexToRgb(tile.valueColor ?? ""),
      })),
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
          sub: c.healthIndex.subLabel ?? undefined,
          valueColor: hexToRgb(c.healthIndex.fillColor),
        },
        {
          label: c.moistureBalanceTitle,
          value: c.moistureBalance.label,
          sub: c.moistureBalance.subLabel ?? undefined,
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

    if (c.healthIndex.metrics.length > 0) {
      blocks.push({
        kind: "section-header",
        label: "Health Index Metrics",
        meta: c.healthIndex.label,
      });

      blocks.push({
        kind: "metric-grid",
        cells: c.healthIndex.metrics.map((metric) => ({
          label: metric.label,
          value: metric.value,
          valueColor: hexToRgb(metric.valueColor ?? ""),
        })),
        columns: c.healthIndex.metrics.length <= 3 ? 3 : 4,
        marginTop: 4,
      });
    }

    if (c.moistureBalance.metrics.length > 0) {
      blocks.push({
        kind: "section-header",
        label: "Moisture Balance Metrics",
        meta: c.moistureBalance.label,
      });

      blocks.push({
        kind: "metric-grid",
        cells: c.moistureBalance.metrics.map((metric) => ({
          label: metric.label,
          value: metric.value,
          valueColor: hexToRgb(metric.valueColor ?? ""),
        })),
        columns: c.moistureBalance.metrics.length <= 3 ? 3 : 4,
        marginTop: 4,
      });
    }
  }

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
      rows: c.thresholds.map((threshold) => ({
        cells: [
          threshold.param,
          threshold.min,
          threshold.optimal,
          threshold.max,
          threshold.actual,
          threshold.status.toUpperCase(),
          threshold.notes,
        ],
        accentColor:
          threshold.status === "danger" ? RED : threshold.status === "warn" ? AMBER : undefined,
      })),
      marginTop: 4,
    });
  }

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
        sub: tile.sub ?? undefined,
        valueColor: hexToRgb(tile.valueColor ?? ""),
      })),
      columns: c.fieldTiles.length <= 3 ? 3 : 4,
      marginTop: 4,
    });
  }

  if (c && c.diseaseRisks.length > 0) {
    blocks.push({
      kind: "section-header",
      label: "Disease Risk Assessment",
      meta: `${c.diseaseRisks.length} tracked`,
      accentColor: AMBER,
    });

    for (const risk of c.diseaseRisks) {
      const severity = inferCropDiseaseRiskSeverity(risk.pct);

      blocks.push({
        kind: "severity-card",
        severity,
        title: `${risk.name} — ${risk.pct}`,
        body: risk.desc,
        action: risk.recommendedAction ?? inferDiseaseRiskFollowUpAction(risk.name, severity),
        marginTop: 4,
      });
    }
  }

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
      const severity = inferCropAlertSeverity(alert.iconKey);

      blocks.push({
        kind: "severity-card",
        severity,
        title: alert.title,
        body: alert.desc,
        action: inferCropAlertFollowUpAction(alert.title),
        marginTop: 4,
      });
    }
  }

  blocks.push({ kind: "divider", marginTop: 16 });

  if (c && c.provenanceRows.length > 0) {
    const heldBack = s?.dataQuality?.label && s.dataQuality.label !== "Ready";
    if (heldBack) {
      blocks.push({
        kind: "text",
        style: "caption",
        text: `Crop interpretation is currently constrained by ${s.dataQuality?.label?.toLowerCase()} field context. Provenance is included so the reader can see which inputs are ${formatAgronomicSourceBasisLabel("source-backed").toLowerCase()}, ${formatAgronomicSourceBasisLabel("modeled").toLowerCase()}, or still ${formatAgronomicSourceBasisLabel("pending").toLowerCase()}.`,
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

export function prepareFieldCropReportArtifact(
  input: PrepareFieldCropReportArtifactInput,
): PreparedFieldCropReportArtifact {
  const blocks = buildBlocks(input);
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const now = formatReportDateStamp(generatedAt);

  const renderInput: PdfRenderInput = {
    artifactKey: `crop-reports/${slugify(input.fieldName)}/${now}.pdf`,
    title: `${input.fieldName} Crop Report`,
    subject: `Crop report for ${input.fieldName}`,
    author: "NocPulse",
    brandLogo: input.brandLogoPngBytes ? { format: "png", bytes: input.brandLogoPngBytes } : undefined,
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
