import assert from "node:assert/strict";
import test from "node:test";
import { prepareFieldCropReportArtifact } from "./prepareFieldCropReportArtifact";
import type { FieldCropProps } from "../../features/fields/tabs/CropTab";
import type { FieldSummaryProps } from "../../components/panels/SummaryTab";

test("prepareFieldCropReportArtifact renders a branded crop PDF artifact", () => {
  const crop: FieldCropProps = {
    cropName: "Canola",
    lld: "SE-19-037-11-W3",
    growthSegments: [
      { label: "Seedling", active: false, color: "#4ade80" },
      { label: "Vegetative", active: true, color: "#16a34a" },
    ],
    accumulatedGddLabel: "182",
    gddUnitLabel: "base 5°C",
    thresholdStageLabel: "Vegetative",
    thresholds: [
      {
        param: "Root Moisture (%)",
        min: "20",
        optimal: "35-70",
        optimalColor: "#16a34a",
        max: "85",
        actual: "28.4%",
        notes: "Below monitor level — watch closely",
        status: "warn",
        borderColor: "#f59e0b44",
      },
    ],
    healthIndexTitle: "Crop Signal",
    healthIndex: {
      value: 0.61,
      label: "Watch",
      subLabel: "Preseason optical context",
      fillColor: "#f59e0b",
      metrics: [{ label: "NDVI", value: "0.42", valueColor: "#f59e0b" }],
    },
    moistureBalanceTitle: "Moisture Balance",
    moistureBalance: {
      value: 0.48,
      label: "Tightening",
      subLabel: "Root moisture 28.4%",
      fillColor: "#3b82f6",
      metrics: [{ label: "Root", value: "28.4%", valueColor: "#3b82f6" }],
    },
    fieldTiles: [
      {
        label: "Last capture",
        value: "Mar 29",
        sub: "Sentinel-2",
        valueColor: "#16a34a",
        bg: "rgba(22,163,74,0.12)",
        border: "rgba(22,163,74,0.25)",
      },
    ],
    diseaseRisks: [
      {
        name: "Sclerotinia",
        desc: "Frost window still dominant over disease pressure.",
        pct: "12%",
        color: "#f59e0b",
        bg: "rgba(245,158,11,0.12)",
      },
    ],
    provenanceLabel: "Crop Provenance",
    provenanceRows: [{ key: "Imagery", value: "Sentinel-2 · Mar 29" }],
    provenanceChips: ["Sentinel-2", "Weather"],
    alerts: [
      {
        iconKey: "temperature",
        iconColor: "#ef4444",
        bg: "rgba(239,68,68,0.12)",
        title: "Frost risk",
        desc: "Critical frost risk next 24h.",
      },
    ],
    footer: "Generated from current crop context and imagery observations.",
  };

  const summary = {
    crop: "Canola",
    cropStage: "Vegetative",
  } as FieldSummaryProps;

  const artifact = prepareFieldCropReportArtifact({
    fieldId: "field-123",
    fieldName: "Krants",
    areaLabel: "64.7 ha",
    crop,
    summary,
    generatedAt: "2026-03-30T09:00:00.000Z",
  });

  const pdfText = Buffer.from(artifact.bytes).toString("utf8");

  assert.equal(artifact.contentType, "application/pdf");
  assert.equal(artifact.fileName, "krants-crop-report-2026-03-30.pdf");
  assert.match(pdfText, /^%PDF-1\.4/);
  assert.match(pdfText, /NocPulse/);
  assert.match(pdfText, /Krants Crop Report/);
  assert.match(pdfText, /CROP SIGNALS/);
  assert.match(pdfText, /ACTIVE CROP ALERTS/);
  assert.match(pdfText, /\/Subtype \/Image/);
});
