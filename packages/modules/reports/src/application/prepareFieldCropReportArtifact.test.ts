import assert from "node:assert/strict";
import test from "node:test";
import {
  prepareFieldCropReportArtifact,
  type FieldCropReportProps,
  type FieldCropReportSummary,
} from "./prepareFieldCropReportArtifact";

test("prepareFieldCropReportArtifact renders a branded crop PDF artifact", () => {
  const crop: FieldCropReportProps = {
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
        max: "85",
        actual: "28.4%",
        notes: "Below monitor level — watch closely",
        status: "warn",
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
      },
    ],
    diseaseRisks: [
      {
        name: "Sclerotinia",
        desc: "Frost window still dominant over disease pressure.",
        pct: "12%",
      },
    ],
    provenanceRows: [{ key: "Imagery", value: "Sentinel-2 · Mar 29" }],
    provenanceChips: ["Sentinel-2", "Weather"],
    alerts: [
      {
        iconKey: "temperature",
        title: "Frost risk",
        desc: "Critical frost risk next 24h.",
      },
    ],
    footer: "Generated from current crop context and imagery observations.",
  };

  const summary: FieldCropReportSummary = {
    crop: "Canola",
    cropStage: "Vegetative",
  };

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
  assert.match(pdfText, /CROP SIGNALS/i);
  assert.match(pdfText, /ACTIVE CROP ALERTS/i);
  assert.match(pdfText, /Consider frost protection measures\. Monitor overnight lows closely\./i);
});

test("prepareFieldCropReportArtifact includes truth and weather pressure context", () => {
  const crop: FieldCropReportProps = {
    cropName: "Rye",
    lld: "NE-10-034-28-W1",
    growthSegments: [
      { label: "Seedling", active: false, color: "#4ade80" },
      { label: "Vegetative", active: true, color: "#16a34a" },
    ],
    accumulatedGddLabel: "96",
    gddUnitLabel: "base 5°C",
    thresholdStageLabel: "Vegetative",
    thresholds: [],
    healthIndexTitle: "Crop Signal",
    healthIndex: {
      value: 0.34,
      label: "Context loaded",
      subLabel: "Preseason canopy context",
      fillColor: "#f59e0b",
      metrics: [{ label: "NDVI", value: "0.02", valueColor: "#f59e0b" }],
    },
    moistureBalanceTitle: "Root Moisture Balance",
    moistureBalance: {
      value: 0.078,
      label: "7.8%",
      subLabel: "Model estimate",
      fillColor: "#3b82f6",
      metrics: [{ label: "Status", value: "Deficit", valueColor: "#ef4444" }],
    },
    fieldTiles: [
      {
        label: "FROST RISK",
        value: "Watch",
        sub: "Min -4.2°C · next 7d",
        valueColor: "#f59e0b",
      },
      {
        label: "CROP WATER DEMAND",
        value: "2.1",
        sub: "Peak next 24h",
        valueColor: "#f59e0b",
      },
      {
        label: "GDD 72H",
        value: "12.3",
        sub: "Base 5°C",
        valueColor: "#16a34a",
      },
      {
        label: "WATER BALANCE",
        value: "-3.8mm",
        sub: "72h forecast balance",
        valueColor: "#ef4444",
      },
    ],
    diseaseRisks: [],
    provenanceRows: [{ key: "Provider", value: "Sentinel-2" }],
    provenanceChips: ["Sentinel-2", "Open-Meteo"],
    alerts: [],
    footer: "Generated from crop context and imagery observations.",
  };

  const summary: FieldCropReportSummary = {
    crop: "Rye",
    cropStage: "Vegetative",
    updatedLabel: "UPDATED APR 2, 2026",
    confidence: "Low",
    confidenceSub: "modeled",
    moistureDerivationMode: "modeled",
    sourceTagExtended: "Model estimate · weather + soil",
    precipitation: "0.0 mm",
    nextRain: "3d",
    rainChance: "20%",
    sevenDayTotal: "4.0 mm",
    trend: "-2.1%",
    confidenceBreakdown: {
      freshness: "Recent weather feed",
      agreement: "Optical support is limited",
      resolution: "Field-scale estimate",
      scaleFit: "Moderate",
    },
    dataSources: {
      satellite: "Sentinel-2 preseason optical",
      weather: "Open-Meteo",
      soil: "Modeled soil profile",
    },
    dataQuality: {
      label: "Limited",
      tone: "warning",
      summary: "Optical validity is still thin for crop interpretation.",
    },
  };

  const artifact = prepareFieldCropReportArtifact({
    fieldId: "field-234",
    fieldName: "Sigurson",
    areaLabel: "129.5 ha",
    crop,
    summary,
    generatedAt: "2026-04-02T09:00:00.000Z",
  });

  const pdfText = Buffer.from(artifact.bytes).toString("utf8");
  assert.match(pdfText, /TRUTH & FRESHNESS/i);
  assert.match(pdfText, /RECENT WEATHER PRESSURE/i);
  assert.match(pdfText, /Limited Context/i);
  assert.match(pdfText, /Modeled \\267 weather \+ soil/i);
  assert.match(pdfText, /source-backed, modeled, or still pending/i);
});
