import { renderPdfDocument } from "@fieldpulse/pdf";
import type { PdfBlock } from "@fieldpulse/pdf";
import type { FieldSummaryProps } from "../../components/panels/SummaryTab";
import type { FieldCropProps } from "../../features/fields/tabs/CropTab";

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* ── Helpers ── */

function thresholdIntent(status: string): "positive" | "warning" | "danger" | "neutral" {
  if (status === "ok") return "positive";
  if (status === "warn") return "warning";
  if (status === "danger") return "danger";
  return "neutral";
}

/* ── Builder ── */

export function prepareFieldCropReportArtifact(input: {
  fieldId: string;
  fieldName: string;
  areaHaLabel: string;
  summary: FieldSummaryProps | null;
  crop: FieldCropProps | null;
}) {
  const crop = input.crop;
  const summary = input.summary;
  const reportDate = new Date().toISOString().slice(0, 10);
  const artifactKey = `field-crop-report/${input.fieldId}/${reportDate}.pdf`;
  const blocks: PdfBlock[] = [];

  /* ── Header ── */

  blocks.push({ style: "title", text: `Crop report: ${input.fieldName}` });
  blocks.push({
    style: "caption",
    text: `Generated ${new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`,
  });

  blocks.push({ type: "spacer", height: 6 });
  blocks.push({ type: "divider" });
  blocks.push({ type: "spacer", height: 4 });

  /* ── Crop overview (key-value pairs) ── */

  blocks.push({ style: "heading", text: "Crop overview" });

  blocks.push({ type: "key-value", label: "Area", value: input.areaHaLabel });
  blocks.push({
    type: "key-value",
    label: "Legal land description",
    value: crop?.lld ?? summary?.lld ?? "—",
  });
  blocks.push({
    type: "key-value",
    label: "Crop",
    value: crop?.cropName ?? summary?.crop ?? "—",
  });
  blocks.push({
    type: "key-value",
    label: "Stage",
    value: crop?.thresholdStageLabel ?? summary?.cropStage ?? "—",
  });
  blocks.push({
    type: "key-value",
    label: "Accumulated GDD",
    value: `${crop?.accumulatedGddLabel ?? "—"} ${crop?.gddUnitLabel ?? ""}`.trim(),
  });

  blocks.push({ type: "spacer", height: 6 });
  blocks.push({ type: "divider" });

  /* ── Growth progression ── */

  blocks.push({ style: "heading", text: "Growth progression" });

  const growthSegments = crop?.growthSegments ?? [];
  if (growthSegments.length === 0) {
    blocks.push({ style: "body", text: "None." });
  } else {
    for (const segment of growthSegments) {
      if (segment.active) {
        blocks.push({
          type: "status",
          label: segment.label,
          status: "active",
          intent: "positive",
        });
      } else {
        blocks.push({ style: "body", text: segment.label });
      }
    }
  }

  blocks.push({ type: "spacer", height: 6 });
  blocks.push({ type: "divider" });

  /* ── Signal summary (metric row) ── */

  blocks.push({ style: "heading", text: "Signal summary" });

  blocks.push({
    type: "metric-row",
    items: [
      {
        label: crop?.healthIndexTitle ?? "Health",
        value: `${crop?.healthIndex.label ?? "—"} (${crop?.healthIndex.subLabel ?? "unavailable"})`,
      },
      {
        label: crop?.moistureBalanceTitle ?? "Moisture",
        value: `${crop?.moistureBalance.label ?? "—"} (${crop?.moistureBalance.subLabel ?? "unavailable"})`,
      },
    ],
  });

  blocks.push({ type: "spacer", height: 6 });
  blocks.push({ type: "divider" });

  /* ── Health metrics (metric row) ── */

  blocks.push({ style: "heading", text: "Health metrics" });

  const healthMetrics = crop?.healthIndex.metrics ?? [];
  if (healthMetrics.length === 0) {
    blocks.push({ style: "body", text: "None." });
  } else {
    for (let i = 0; i < healthMetrics.length; i += 4) {
      const chunk = healthMetrics.slice(i, i + 4);
      blocks.push({
        type: "metric-row",
        items: chunk.map((m) => ({ label: m.label, value: m.value })),
      });
    }
  }

  blocks.push({ type: "spacer", height: 6 });
  blocks.push({ type: "divider" });

  /* ── Moisture metrics (metric row) ── */

  blocks.push({ style: "heading", text: "Moisture metrics" });

  const moistureMetrics = crop?.moistureBalance.metrics ?? [];
  if (moistureMetrics.length === 0) {
    blocks.push({ style: "body", text: "None." });
  } else {
    for (let i = 0; i < moistureMetrics.length; i += 4) {
      const chunk = moistureMetrics.slice(i, i + 4);
      blocks.push({
        type: "metric-row",
        items: chunk.map((m) => ({ label: m.label, value: m.value })),
      });
    }
  }

  blocks.push({ type: "spacer", height: 6 });
  blocks.push({ type: "divider" });

  /* ── Thresholds (status + key-value) ── */

  blocks.push({ style: "heading", text: "Thresholds" });

  const thresholds = crop?.thresholds ?? [];
  if (thresholds.length === 0) {
    blocks.push({ style: "body", text: "None." });
  } else {
    for (const threshold of thresholds) {
      blocks.push({
        type: "status",
        label: threshold.param,
        status: threshold.status,
        intent: thresholdIntent(threshold.status),
      });
      blocks.push({
        type: "metric-row",
        items: [
          { label: "Min", value: threshold.min },
          { label: "Optimal", value: threshold.optimal },
          { label: "Max", value: threshold.max },
        ],
      });
      blocks.push({ type: "spacer", height: 4 });
    }
  }

  blocks.push({ type: "spacer", height: 6 });
  blocks.push({ type: "divider" });

  /* ── Field context (key-value) ── */

  blocks.push({ style: "heading", text: "Field context" });

  const fieldTiles = crop?.fieldTiles ?? [];
  if (fieldTiles.length === 0) {
    blocks.push({ style: "body", text: "None." });
  } else {
    for (const tile of fieldTiles) {
      blocks.push({
        type: "key-value",
        label: tile.label,
        value: tile.value,
        suffix: tile.sub,
      });
    }
  }

  blocks.push({ type: "spacer", height: 6 });
  blocks.push({ type: "divider" });

  /* ── Disease risks (status blocks) ── */

  blocks.push({ style: "heading", text: "Disease risks" });

  const diseaseRisks = crop?.diseaseRisks ?? [];
  if (diseaseRisks.length === 0) {
    blocks.push({ style: "body", text: "None." });
  } else {
    for (const risk of diseaseRisks) {
      blocks.push({
        type: "status",
        label: `${risk.name} — ${risk.pct}`,
        status: risk.desc,
        intent: "warning",
      });
    }
  }

  blocks.push({ type: "spacer", height: 6 });
  blocks.push({ type: "divider" });

  /* ── Active crop alerts ── */

  blocks.push({ style: "heading", text: "Active crop alerts" });

  const alerts = crop?.alerts ?? [];
  if (alerts.length === 0) {
    blocks.push({ style: "body", text: "None." });
  } else {
    for (const alert of alerts) {
      blocks.push({ style: "subheading", text: alert.title });
      blocks.push({ style: "body", text: alert.desc });
    }
  }

  blocks.push({ type: "spacer", height: 6 });
  blocks.push({ type: "divider" });

  /* ── Provenance ── */

  blocks.push({ style: "heading", text: crop?.provenanceLabel ?? "Provenance" });

  const provenanceRows = crop?.provenanceRows ?? [];
  if (provenanceRows.length === 0) {
    blocks.push({ style: "body", text: "No provenance available." });
  } else {
    for (const row of provenanceRows) {
      blocks.push({ type: "key-value", label: row.key, value: row.value });
    }
  }

  if ((crop?.provenanceChips ?? []).length > 0) {
    blocks.push({
      type: "key-value",
      label: "Source chips",
      value: (crop?.provenanceChips ?? []).join(", "),
    });
  }

  if (crop?.footer) {
    blocks.push({ style: "caption", text: crop.footer });
  }

  /* ── Render ── */

  const pdf = renderPdfDocument({
    artifactKey,
    title: `Crop report: ${input.fieldName}`,
    subject: "Field crop report export",
    author: "NocPulse",
    blocks,
  });

  return {
    bytes: pdf.bytes,
    contentType: "application/pdf" as const,
    cacheControl: "private, max-age=0, no-cache",
    fileName: `${slugify(input.fieldName)}-crop-report-${reportDate}.pdf`,
  };
}
