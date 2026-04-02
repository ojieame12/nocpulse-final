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

test("prepareFieldCropReportArtifact includes truth and weather pressure context", () => {
  const crop: FieldCropProps = {
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
        bg: "rgba(245,158,11,0.12)",
        border: "rgba(245,158,11,0.25)",
      },
      {
        label: "CROP WATER DEMAND",
        value: "2.1",
        sub: "Peak next 24h",
        valueColor: "#f59e0b",
        bg: "rgba(245,158,11,0.12)",
        border: "rgba(245,158,11,0.25)",
      },
      {
        label: "GDD 72H",
        value: "12.3",
        sub: "Base 5°C",
        valueColor: "#16a34a",
        bg: "rgba(22,163,74,0.12)",
        border: "rgba(22,163,74,0.25)",
      },
      {
        label: "WATER BALANCE",
        value: "-3.8mm",
        sub: "72h forecast balance",
        valueColor: "#ef4444",
        bg: "rgba(239,68,68,0.12)",
        border: "rgba(239,68,68,0.25)",
      },
    ],
    diseaseRisks: [],
    provenanceLabel: "IMAGERY PROVENANCE",
    provenanceRows: [{ key: "Provider", value: "Sentinel-2" }],
    provenanceChips: ["Sentinel-2", "Open-Meteo"],
    alerts: [],
    footer: "Generated from crop context and imagery observations.",
  };

  const summary: FieldSummaryProps = {
    name: "Sigurson",
    lld: "NE-10-034-28-W1",
    crop: "Rye",
    cropStage: "Vegetative",
    contextLabel: "Field overview",
    conditionsMeta: "Field average",
    updatedLabel: "UPDATED APR 2, 2026",
    moisture: 0.078,
    cloudCover: "14%",
    surfaceMoisture: "6%",
    fieldState: "Dry",
    fieldStateColor: "#f59e0b",
    rootMoisture: "7.8%",
    rootMoistureSub: "Severe deficit",
    trend: "-2.1%",
    trendSub: "vs weather + soil model",
    spread: "0.02",
    spreadSub: "2 mapped cells",
    confidence: "Low",
    confidenceSub: "modeled",
    moistureConfidenceLevel: "low",
    moistureDerivationMode: "modeled",
    sourceTagExtended: "Model estimate · weather + soil",
    precipitation: "0.0 mm",
    precipitationSub: "Current observation",
    nextRain: "3d",
    nextRainSub: "Forecast window",
    rainChance: "20%",
    rainChanceSub: "Next window",
    sevenDayTotal: "4.0 mm",
    sevenDayTotalSub: "Loaded forecast",
    alerts: [],
    outlook: [],
    confidenceBreakdown: {
      freshness: "Recent weather feed",
      agreement: "Optical support is limited",
      resolution: "Field-scale estimate",
      scaleFit: "Moderate",
      sourceAge: "Recent weather feed",
      coverage: "Field-scale estimate",
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
      reasons: ["Limited canopy support."],
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
  assert.match(pdfText, /Model estimate/i);
});
