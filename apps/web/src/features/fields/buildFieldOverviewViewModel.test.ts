import test from "node:test";
import assert from "node:assert/strict";
import { buildFieldActionCurationVersion } from "@fieldpulse/module-crop-intelligence";
import {
  buildEffectiveMoistureSummary,
  buildMarketProps,
  buildReportProps,
  resolveCanopySignalPresentation,
  resolveCropStagePresentation,
  resolveOpticalSeasonality,
  deriveSummaryStatusLabel,
  deriveSummaryConfidenceBreakdown,
  deriveSummaryDataSources,
  deriveSummaryDataQuality,
} from "./buildFieldOverviewViewModel";
import { buildActionProps } from "./buildFieldOverviewViewModel.action";
import {
  filterFieldQualityDependentAlertRecords,
  resolveHistoricalAnomalyFromReadModel,
} from "./buildFieldOverviewViewModel.shared";
import { buildCropProps } from "./buildFieldOverviewViewModel.crop";
import { buildActivityPanelModel } from "./buildFieldOverviewViewModel.panels";

function createBaseReadModel() {
  return {
    generatedAt: "2026-03-28T12:00:00Z",
    intake: {
      legalLandDescription: "NW-25-010-17-W4",
    },
    cropContext: {
      cropType: "canola",
      growthStage: "flowering",
      seasonYear: 2026,
    },
    summary: {
      cropType: "canola",
      activeAlertCount: 1,
      activeFindingCount: 2,
    },
    moisture: {
      latestSnapshot: {
        rootZonePct: 41.2,
        confidence: "high",
        sourceKey: "sentinel-hub-stats-v1:sentinel-1",
      },
    },
    weather: {
      signals: {
        netWaterBalance72hMm: -6.4,
        sourceKey: "open-meteo:derived",
      },
    },
  };
}

test("buildMarketProps computes gross revenue from quote plus stored yield assumption", () => {
  const props = buildMarketProps(
    createBaseReadModel(),
    "field-123",
    "North Quarter Demo",
    64.2,
    {
      cropSymbol: "CANOLA",
      closePriceCadPerTonne: 720.5,
      basisCadPerTonne: -12,
      sourceCurrency: "CAD",
      sourceUnit: "tonne",
      sourceClosePrice: 720.5,
      fxRateToCad: 1,
      sourceKey: "manual-admin",
      capturedAt: "2026-03-27T00:00:00Z",
    },
    [
      {
        cropSymbol: "CANOLA",
        closePriceCadPerTonne: 701.5,
        basisCadPerTonne: -12,
        sourceCurrency: "CAD",
        sourceUnit: "tonne",
        sourceClosePrice: 701.5,
        fxRateToCad: 1,
        sourceKey: "manual-admin",
        capturedAt: "2026-03-25T00:00:00Z",
        createdAt: "2026-03-25T00:00:00Z",
      },
      {
        cropSymbol: "CANOLA",
        closePriceCadPerTonne: 720.5,
        basisCadPerTonne: -12,
        sourceCurrency: "CAD",
        sourceUnit: "tonne",
        sourceClosePrice: 720.5,
        fxRateToCad: 1,
        sourceKey: "manual-admin",
        capturedAt: "2026-03-27T00:00:00Z",
        createdAt: "2026-03-27T00:00:00Z",
      },
    ],
    null,
    {
      cropSymbol: "CANOLA",
      yieldTonnesPerHa: 2.4,
      sourceKey: "manual-panel",
      assumedAt: "2026-03-28T00:00:00Z",
      noteText: "Field manager estimate",
    },
  );

  assert.equal(props.fieldId, "field-123");
  assert.equal(props.cropSymbol, "CANOLA");
  assert.equal(props.availabilityState, "ready");
  assert.equal(props.availabilityReasonLabel, null);
  assert.equal(props.valuationState, "scenario");
  assert.equal(props.referenceStatusLabel, "Stored");
  assert.equal(props.valuationStatusLabel, "Scenario");
  assert.deepEqual(props.missingInputs, []);
  assert.equal(props.provisionalRevenueLabel, "$109,166");
  assert.equal(props.provisionalRevenueSubLabel, "Scenario");
  assert.equal(props.yieldTonnesPerHa, 2.4);
  assert.equal(props.estimatedGrossLabel, "$109,166");
  assert.equal(props.grossRevenueLabel, "$109,166");
  assert.equal(props.contextLabel, "2-capture history");
  assert.equal(props.priceBars.length, 2);
  assert.equal(props.rangeLowLabel, "Recent low: $701.50");
  assert.equal(props.rangeHighLabel, "Recent high: $720.50");
  assert.deepEqual(props.revenueRows, [
    { label: "Expected Yield", value: "2.40 t/ha" },
    { label: "Price at Harvest", value: "$708.50/t" },
    { label: "Local Basis", value: "-12.00 CAD/t" },
    { label: "Field Area", value: "64.2 ha" },
  ]);
  assert.match(props.revenueNote, /manual-panel/i);
  assert.match(props.disclaimerText, /stored field yield assumption/i);
});

test("buildMarketProps derives the current quote from stored recent history when no direct latest quote is provided", () => {
  const props = buildMarketProps(
    createBaseReadModel(),
    "field-123",
    "North Quarter Demo",
    64.2,
    null,
    [
      {
        cropSymbol: "CANOLA",
        closePriceCadPerTonne: 701.5,
        basisCadPerTonne: -12,
        sourceCurrency: "CAD",
        sourceUnit: "tonne",
        sourceClosePrice: 701.5,
        fxRateToCad: 1,
        sourceKey: "manual-admin",
        capturedAt: "2026-03-25T00:00:00Z",
        createdAt: "2026-03-25T00:00:00Z",
      },
      {
        cropSymbol: "CANOLA",
        closePriceCadPerTonne: 720.5,
        basisCadPerTonne: -9,
        sourceCurrency: "CAD",
        sourceUnit: "tonne",
        sourceClosePrice: 720.5,
        fxRateToCad: 1,
        sourceKey: "manual-admin",
        capturedAt: "2026-03-27T00:00:00Z",
        createdAt: "2026-03-27T00:00:00Z",
      },
    ],
    null,
    {
      cropSymbol: "CANOLA",
      yieldTonnesPerHa: 2.4,
      sourceKey: "manual-panel",
      assumedAt: "2026-03-28T00:00:00Z",
      noteText: "Field manager estimate",
    },
  );

  assert.equal(props.availabilityState, "ready");
  assert.equal(props.closePriceCadPerTonne, 720.5);
  assert.equal(props.priceLabel, "$720.50");
  assert.match(props.quoteStatusLabel ?? "", /\$720\.50\/t/);
  assert.equal(props.provisionalRevenueLabel, "$109,628");
});

test("buildMarketProps ignores a mismatched crop yield assumption", () => {
  const props = buildMarketProps(
    createBaseReadModel(),
    "field-123",
    "North Quarter Demo",
    64.2,
    {
      cropSymbol: "CANOLA",
      closePriceCadPerTonne: 720.5,
      basisCadPerTonne: 0,
      sourceCurrency: "CAD",
      sourceUnit: "tonne",
      sourceClosePrice: 720.5,
      fxRateToCad: 1,
      sourceKey: "manual-admin",
      capturedAt: "2026-03-27T00:00:00Z",
    },
    [],
    null,
    {
      cropSymbol: "WHEAT",
      yieldTonnesPerHa: 3.2,
      sourceKey: "manual-panel",
      assumedAt: "2026-03-28T00:00:00Z",
      noteText: null,
    },
  );

  assert.equal(props.yieldTonnesPerHa, null);
  assert.equal(props.availabilityState, "yield-unavailable");
  assert.equal(props.valuationState, "reference-only");
  assert.equal(props.valuationStatusLabel, "Yield N/A");
  assert.deepEqual(props.missingInputs, ["yield"]);
  assert.equal(props.primaryActionLabel, "Add field yield");
  assert.equal(props.provisionalRevenueLabel, "$720.50/t");
  assert.equal(props.provisionalRevenueSubLabel, "Price at harvest");
  assert.match(props.availabilityReasonLabel ?? "", /yield assumption/i);
  assert.equal(props.estimatedGrossLabel, "—");
  assert.equal(props.grossRevenueLabel, "—");
  assert.equal(props.revenueRows[0]?.value, "N/A");
  assert.match(props.revenueNote, /yield assumption is stored/i);
});

test("buildMarketProps prefers a field-local basis assumption over the quote basis", () => {
  const props = buildMarketProps(
    createBaseReadModel(),
    "field-123",
    "North Quarter Demo",
    64.2,
    {
      cropSymbol: "CANOLA",
      closePriceCadPerTonne: 720.5,
      basisCadPerTonne: 0,
      sourceCurrency: "CAD",
      sourceUnit: "tonne",
      sourceClosePrice: 720.5,
      fxRateToCad: 1,
      sourceKey: "manual-admin",
      capturedAt: "2026-03-27T00:00:00Z",
    },
    [],
    {
      cropSymbol: "CANOLA",
      basisCadPerTonne: -12,
      sourceKey: "manual-panel",
      assumedAt: "2026-03-28T00:00:00Z",
      noteText: "Local elevator bid",
    },
    {
      cropSymbol: "CANOLA",
      yieldTonnesPerHa: 2.4,
      sourceKey: "manual-panel",
      assumedAt: "2026-03-28T00:00:00Z",
      noteText: null,
    },
  );

  assert.equal(props.basisCadPerTonne, -12);
  assert.equal(props.basisAssumptionCadPerTonne, -12);
  assert.equal(props.valuationState, "scenario");
  assert.equal(props.primaryActionLabel, "Refine field scenario");
  assert.equal(props.revenueRows[1]?.value, "$708.50/t");
  assert.equal(props.revenueRows[2]?.value, "-12.00 CAD/t");
  assert.equal(props.grossRevenueLabel, "$109,166");
  assert.match(props.quoteStatusLabel ?? "", /Field basis -12.00 CAD\/t/);
});

test("buildMarketProps explains unsupported market crops", () => {
  const readModel = createBaseReadModel();
  readModel.cropContext.cropType = "faba bean";
  readModel.summary.cropType = "faba bean";

  const props = buildMarketProps(
    readModel,
    "field-123",
    "North Quarter Demo",
    64.2,
    null,
    [],
    null,
    null,
  );

  assert.equal(props.cropSymbol, null);
  assert.equal(props.availabilityState, "unsupported-crop");
  assert.equal(props.valuationState, "unsupported");
  assert.equal(props.primaryActionLabel, "N/A");
  assert.match(props.availabilityReasonLabel ?? "", /no live quote symbol/i);
  assert.equal(props.priceBars.length, 0);
});

test("buildMarketProps treats rye as a live-feed crop even before quotes are stored", () => {
  const readModel = createBaseReadModel();
  readModel.cropContext.cropType = "rye";
  readModel.summary.cropType = "rye";

  const props = buildMarketProps(
    readModel,
    "field-123",
    "North Quarter Demo",
    64.2,
    null,
    [],
    null,
    null,
  );

  assert.equal(props.cropSymbol, "RYE");
  assert.equal(props.availabilityState, "quote-and-yield-unavailable");
  assert.equal(props.valuationState, "reference-only");
  assert.equal(props.referenceStatusLabel, "Pending");
  assert.equal(props.valuationStatusLabel, "Quote N/A · Yield N/A");
  assert.deepEqual(props.missingInputs, ["quote", "yield"]);
  assert.equal(props.primaryActionLabel, "Add manual quote and yield");
  assert.equal(props.priceSubmitUrl, "/api/market/prices");
  assert.match(props.availabilityReasonLabel ?? "", /no live RYE quote is stored yet/i);
});

test("buildMarketProps marks stored yield without quote as provisional", () => {
  const props = buildMarketProps(
    createBaseReadModel(),
    "field-123",
    "North Quarter Demo",
    64.2,
    null,
    [],
    null,
    {
      cropSymbol: "CANOLA",
      yieldTonnesPerHa: 2.8,
      sourceKey: "manual-panel",
      assumedAt: "2026-03-28T00:00:00Z",
      noteText: "Early field estimate",
    },
  );

  assert.equal(props.availabilityState, "quote-unavailable");
  assert.equal(props.valuationState, "provisional");
  assert.equal(props.referenceStatusLabel, "Pending");
  assert.equal(props.valuationStatusLabel, "Quote N/A");
  assert.deepEqual(props.missingInputs, ["quote"]);
  assert.equal(props.primaryActionLabel, "Add manual quote");
  assert.equal(props.provisionalRevenueLabel, "—");
  assert.equal(props.provisionalRevenueSubLabel, "Yield only");
});

test("buildMarketProps holds back field-dependent active signals on limited fields", () => {
  const readModel = {
    ...createBaseReadModel(),
    summary: {
      ...createBaseReadModel().summary,
      dataQuality: {
        label: "Limited",
      },
    },
    alerts: [
      {
        id: "alert-1",
        family: "moisture_stress",
        severity: "medium",
        title: "Moisture stress building",
        summary: "Drying is starting to spread.",
      },
    ],
    findings: [
      {
        id: "finding-1",
        family: "disease_risk",
        severity: "medium",
        title: "Blackleg watch",
        summary: "Humidity is supporting disease pressure.",
      },
    ],
  };

  const props = buildMarketProps(
    readModel,
    "field-123",
    "North Quarter Demo",
    64.2,
    null,
    [],
    null,
    null,
  );

  const activeSignalsTile = props.contextTiles[2];
  assert.equal(activeSignalsTile?.label, "ACTIVE SIGNALS");
  assert.equal(activeSignalsTile?.value, "0");
  assert.match(activeSignalsTile?.sub ?? "", /held back/i);
  assert.match(activeSignalsTile?.sub ?? "", /Flowering/i);
});

test("buildEffectiveMoistureSummary derives real moisture values from raster cells before falling back to synthetic preview", () => {
  const summary = buildEffectiveMoistureSummary({
    moisture: {
      latestSnapshot: null,
      latestCells: [],
      latestCellCount: 0,
      lowConfidenceCellCount: 0,
      rootZoneMinPct: null,
      rootZoneMaxPct: null,
      rootZoneAvgPct: null,
      surfaceMinPct: null,
      surfaceMaxPct: null,
      surfaceAvgPct: null,
    },
    imagery: {
      latestRasterObservation: {
        sourceKey: "sentinel-hub-stats-v1:sentinel-1",
        observedAt: "2026-03-28T12:00:00Z",
        cells: [
          {
            cellKey: "cell-1",
            rowIndex: 0,
            columnIndex: 0,
            centroid: [-108.18, 51.89],
            boundary: {
              type: "Polygon",
              coordinates: [[
                [-108.181, 51.889],
                [-108.179, 51.889],
                [-108.179, 51.891],
                [-108.181, 51.891],
                [-108.181, 51.889],
              ]],
            },
            measurements: {
              ndmi: 0.7,
              ndvi: 0.6,
            },
          },
        ],
      },
    },
  });

  assert.equal(summary.latestSnapshot?.sourceKey, "imagery-raster-derived-v1:sentinel-hub-stats-v1:sentinel-1");
  assert.equal(summary.latestSnapshot?.confidence, "medium");
  assert.equal(summary.latestCellCount, 1);
  assert.equal(summary.latestCells[0]?.sourceKey, "imagery-raster-derived-v1:sentinel-hub-stats-v1:sentinel-1");
  assert.equal(summary.latestCells[0]?.confidence, "medium");
  assert.equal(summary.rootZoneAvgPct, 59.6);
  assert.equal(summary.surfaceAvgPct, 42);
});

test("buildEffectiveMoistureSummary prefers a SAR raster over a newer generic optical raster for moisture derivation", () => {
  const summary = buildEffectiveMoistureSummary({
    moisture: {
      latestSnapshot: null,
      latestCells: [],
    },
    imagery: {
      latestRasterObservation: {
        sourceKey: "sentinel-hub-stats-v1:sentinel-2",
        observedAt: "2026-03-28T12:00:00Z",
        cells: [
          {
            cellKey: "optical-cell",
            rowIndex: 0,
            columnIndex: 0,
            centroid: [-108.18, 51.89],
            boundary: {
              type: "Polygon",
              coordinates: [[
                [-108.181, 51.889],
                [-108.179, 51.889],
                [-108.179, 51.891],
                [-108.181, 51.891],
                [-108.181, 51.889],
              ]],
            },
            measurements: {
              ndvi: 0.04,
              ndmi: 0.7,
            },
          },
        ],
      },
      latestSarRasterObservation: {
        sourceKey: "sentinel-hub-stats-v1:sentinel-1",
        observedAt: "2026-03-27T12:00:00Z",
        cells: [
          {
            cellKey: "sar-cell",
            rowIndex: 0,
            columnIndex: 0,
            centroid: [-108.18, 51.89],
            boundary: {
              type: "Polygon",
              coordinates: [[
                [-108.181, 51.889],
                [-108.179, 51.889],
                [-108.179, 51.891],
                [-108.181, 51.891],
                [-108.181, 51.889],
              ]],
            },
            measurements: {
              sarWetness: 0.31,
            },
          },
        ],
      },
    },
  });

  assert.equal(
    summary.latestSnapshot?.sourceKey,
    "imagery-raster-derived-v1:sentinel-hub-stats-v1:sentinel-1",
  );
  assert.equal(summary.latestCells[0]?.sourceKey, "imagery-raster-derived-v1:sentinel-hub-stats-v1:sentinel-1");
});

test("resolveCropStagePresentation treats derived zero-GDD stages as unverified and falls back to the crop default stage for thresholds", () => {
  const presentation = resolveCropStagePresentation({
    cropContext: {
      growthStage: "pre-seed",
      growthStageSource: "derived",
      accumulatedGdd: 0,
    },
    fallbackGrowthStage: null,
    defaultGrowthStage: "vegetative",
    gddBaseC: 5,
  });

  assert.equal(presentation.displayStageLabel, "Stage unverified");
  assert.equal(presentation.ruleStage, "vegetative");
  assert.equal(presentation.thresholdStageLabel, "Vegetative default stage");
  assert.equal(presentation.accumulatedGddLabel, "—");
  assert.equal(presentation.gddUnitLabel, "Season heat units unavailable (base 5°C)");
  assert.equal(presentation.stageSourceLabel, "Weather-derived stage still initializing");
  assert.equal(presentation.hasCredibleAccumulatedGdd, false);
});

test("resolveCropStagePresentation preserves a manual stage override even without season GDD", () => {
  const presentation = resolveCropStagePresentation({
    cropContext: {
      growthStage: "flowering",
      growthStageSource: "manual",
      accumulatedGdd: 0,
    },
    fallbackGrowthStage: null,
    defaultGrowthStage: "vegetative",
    gddBaseC: 5,
  });

  assert.equal(presentation.displayStageLabel, "Flowering");
  assert.equal(presentation.ruleStage, "flowering");
  assert.equal(presentation.thresholdStageLabel, "Flowering stage");
  assert.equal(presentation.accumulatedGddLabel, "—");
  assert.equal(presentation.stageSourceLabel, "Manual stage override");
  assert.equal(presentation.hasCredibleAccumulatedGdd, false);
});

test("resolveOpticalSeasonality marks late-March low-canopy captures as context-only when stage is unverified", () => {
  const seasonality = resolveOpticalSeasonality({
    cropStagePresentation: {
      displayStageLabel: "Stage unverified",
      ruleStage: "vegetative",
      thresholdStageLabel: "Vegetative default stage",
      accumulatedGddLabel: "—",
      gddUnitLabel: "Season GDD unavailable (base 5°C)",
      stageSourceLabel: "Weather-derived stage still initializing",
      hasCredibleAccumulatedGdd: false,
    },
    latestOpticalCaptureAt: "2026-03-27T20:19:00Z",
    ndviAvg: 0.04,
    ndreAvg: 0.0,
  });

  assert.equal(seasonality.status, "context-only");
  assert.equal(seasonality.label, "Preseason optical context");
  assert.equal(seasonality.renderConfidence, "low");
});

test("resolveOpticalSeasonality keeps verified in-season captures interpretable", () => {
  const seasonality = resolveOpticalSeasonality({
    cropStagePresentation: {
      displayStageLabel: "Flowering",
      ruleStage: "flowering",
      thresholdStageLabel: "Flowering stage",
      accumulatedGddLabel: "640",
      gddUnitLabel: "Accumulated GDD (base 5°C)",
      stageSourceLabel: "Manual stage override",
      hasCredibleAccumulatedGdd: true,
    },
    latestOpticalCaptureAt: "2026-07-15T18:00:00Z",
    ndviAvg: 0.72,
    ndreAvg: 0.31,
  });

  assert.equal(seasonality.status, "in-season");
  assert.equal(seasonality.label, "Optical canopy signal");
  assert.equal(seasonality.renderConfidence, null);
});

test("resolveOpticalSeasonality trusts a credible derived stage even in early-season calendar windows", () => {
  const seasonality = resolveOpticalSeasonality({
    cropStagePresentation: {
      displayStageLabel: "Vegetative",
      ruleStage: "vegetative",
      thresholdStageLabel: "Vegetative stage",
      accumulatedGddLabel: "148",
      gddUnitLabel: "GDD accumulated (base 5°C)",
      stageSourceLabel: "Weather-derived crop stage",
      hasCredibleAccumulatedGdd: true,
    },
    latestOpticalCaptureAt: "2026-04-05T18:00:00Z",
    ndviAvg: 0.11,
    ndreAvg: 0.04,
  });

  assert.equal(seasonality.status, "in-season");
  assert.equal(seasonality.label, "Optical canopy signal");
  assert.equal(seasonality.renderConfidence, null);
});

test("resolveCanopySignalPresentation returns richer in-season stage language", () => {
  const presentation = resolveCanopySignalPresentation({
    cropStagePresentation: {
      displayStageLabel: "Vegetative",
      ruleStage: "vegetative",
      thresholdStageLabel: "Vegetative stage",
      accumulatedGddLabel: "148",
      gddUnitLabel: "GDD accumulated (base 5°C)",
      stageSourceLabel: "Weather-derived crop stage",
      hasCredibleAccumulatedGdd: true,
    },
    opticalSeasonality: {
      status: "in-season",
      label: "Seasonally interpretable",
      detail: "Optical canopy values are seasonally valid for agronomic interpretation.",
      renderConfidence: null,
    },
    ndviAvg: 0.62,
    ndreAvg: 0.24,
    hasOpticalRaster: true,
  });

  assert.equal(presentation.cropTitle, "VEGETATIVE CANOPY SIGNAL");
  assert.equal(presentation.cropValue, "Developing");
  assert.equal(presentation.cropSubLabel, "Vegetative stage");
  assert.equal(presentation.reportHealthStatus, "Vegetative Developing");
  assert.equal(presentation.reportVegetationSubtitle, "Vegetative canopy history");
  assert.equal(presentation.actionConfidenceLabel, "Source-backed imagery");
});

test("resolveCanopySignalPresentation normalizes context-only and pending imagery confidence labels", () => {
  const contextOnly = resolveCanopySignalPresentation({
    cropStagePresentation: {
      displayStageLabel: "Stage unverified",
      ruleStage: "seedling",
      thresholdStageLabel: "Seedling default stage",
      accumulatedGddLabel: "—",
      gddUnitLabel: "Season heat units unavailable (base 5°C)",
      stageSourceLabel: "Weather-derived stage still initializing",
      hasCredibleAccumulatedGdd: false,
    },
    opticalSeasonality: {
      status: "context-only",
      label: "Preseason optical context",
      detail: "Optical canopy values are being shown for context only.",
      renderConfidence: "low",
    },
    ndviAvg: 0.08,
    ndreAvg: 0.03,
    hasOpticalRaster: true,
  });

  const pending = resolveCanopySignalPresentation({
    cropStagePresentation: {
      displayStageLabel: "Vegetative",
      ruleStage: "vegetative",
      thresholdStageLabel: "Vegetative stage",
      accumulatedGddLabel: "148",
      gddUnitLabel: "GDD accumulated (base 5°C)",
      stageSourceLabel: "Weather-derived crop stage",
      hasCredibleAccumulatedGdd: true,
    },
    opticalSeasonality: {
      status: "in-season",
      label: "Seasonally interpretable",
      detail: "Optical canopy values are seasonally valid for agronomic interpretation.",
      renderConfidence: null,
    },
    ndviAvg: null,
    ndreAvg: null,
    hasOpticalRaster: false,
  });

  assert.equal(contextOnly.actionConfidenceLabel, "Context-only imagery");
  assert.equal(pending.actionConfidenceLabel, "Pending imagery");
});

test("buildReportProps surfaces unavailable alert data without presenting an all-clear empty state", () => {
  const readModel = {
    ...createBaseReadModel(),
    summary: {
      ...createBaseReadModel().summary,
      activeAlertCount: null,
    },
    dataAvailability: {
      activeAlerts: false,
      resolvedAlerts: true,
    },
    alerts: [],
    findings: [],
    zones: { zones: [] },
    weather: {
      profile: {
        latestObservation: null,
        forecasts: [],
      },
      signals: null,
    },
  };

  const props = buildReportProps(
    readModel,
    "North Quarter Demo",
    () => "just now",
  );

  assert.equal(props.healthStatus, "Partial Data");
  assert.equal(props.alerts.length, 0);
  assert.equal(props.alertsEmptyStateTitle, "Alert data unavailable");
  assert.match(props.alertsEmptyStateDescription ?? "", /could not be loaded/i);
});

test("filterFieldQualityDependentAlertRecords keeps only independent alert families on limited fields", () => {
  const alerts = filterFieldQualityDependentAlertRecords(
    [
      { id: "moisture", family: "moisture_stress" },
      { id: "action", family: "action_brief" },
      { id: "weather", family: "weather_risk" },
      { id: "hail", family: "hail_risk" },
    ],
    "Limited",
  );

  assert.deepEqual(
    alerts.map((alert) => alert.id),
    ["weather", "hail"],
  );
});

test("buildReportProps suppresses field-quality-dependent alerts on limited fields", () => {
  const readModel = {
    ...createBaseReadModel(),
    summary: {
      ...createBaseReadModel().summary,
      activeAlertCount: 2,
      dataQuality: {
        label: "Limited",
      },
    },
    dataAvailability: {
      activeAlerts: true,
      resolvedAlerts: true,
    },
    alerts: [
      {
        id: "alert-1",
        family: "moisture_stress",
        severity: "medium",
        title: "Moisture stress building",
        summary: "Drying is starting to spread.",
        evidence: { trackedZoneIds: [] },
      },
      {
        id: "alert-2",
        family: "weather_risk",
        severity: "critical",
        title: "Critical frost risk next 24h",
        summary: "Forecast minimum breaches the frost threshold.",
        evidence: { trackedZoneIds: [] },
      },
    ],
    findings: [],
    zones: { zones: [] },
    weather: {
      profile: {
        latestObservation: null,
        forecasts: [],
      },
      signals: null,
    },
  };

  const props = buildReportProps(
    readModel,
    "North Quarter Demo",
    () => "just now",
  );

  assert.equal(props.alerts.length, 1);
  assert.equal(props.alerts[0]?.text, "Forecast minimum breaches the frost threshold.");
  assert.equal(props.healthStatus, "Needs Attention");
});

test("buildReportProps returns a full seven-day outlook when seven forecast days are available", () => {
  const readModel = {
    ...createBaseReadModel(),
    alerts: [],
    findings: [],
    zones: { zones: [] },
    weather: {
      profile: {
        latestObservation: {
          airTemperatureC: 6.5,
          soilMoisturePct: 21.4,
          windSpeedKph: 14,
          providerKey: "open-meteo",
        },
        forecasts: Array.from({ length: 7 }, (_, index) => ({
          validAt: new Date(Date.UTC(2026, 2, 30 + index, 12, 0, 0)).toISOString(),
          airTemperatureMaxC: 8 + index,
          airTemperatureMinC: -2 + index,
          precipitationProbabilityPct: 15 + index * 5,
          precipitationMm: 0.5 * index,
        })),
      },
      signals: null,
    },
  };

  const props = buildReportProps(
    readModel,
    "North Quarter Demo",
    () => "just now",
  );

  assert.equal(props.forecast.length, 7);
  assert.equal(props.charts[2]?.series[0]?.points.length, 8);
});

test("buildActionProps returns none state when no active intelligence or watchlist signals exist", () => {
  const readModel = {
    ...createBaseReadModel(),
    summary: {
      ...createBaseReadModel().summary,
      activeAlertCount: 0,
      activeFindingCount: 0,
      activeTrackedZoneCount: 0,
    },
    findings: [],
    alerts: [],
    zones: {
      zones: [],
      newZoneCount: 0,
      persistentZoneCount: 0,
      recoveringZoneCount: 0,
    },
    moisture: {
      latestSnapshot: {
        rootZonePct: 48.2,
        surfacePct: 34.1,
        confidence: "high",
        observedAt: "2026-03-29T09:30:00.000Z",
        sourceKey: "sentinel-hub-stats-v1:sentinel-1",
      },
    },
    weather: {
      signals: {
        peakForecastVpdKpa24h: 0.4,
        frostRiskMinTempC: 4.1,
        netWaterBalance72hMm: 3.2,
        updatedAt: "2026-03-29T10:15:00.000Z",
        sourceKey: "open-meteo:derived",
      },
    },
  };

  const action = buildActionProps(readModel, "North Quarter Demo");

  assert.equal(action.intelligenceState, "none");
  assert.equal(action.activeFindingCount, 0);
  assert.equal(action.activeZoneCount, 0);
  assert.equal(action.topRiskTitle, "No active intelligence signal");
  assert.equal(action.intelligenceSourceLabel, "No active intelligence");
  assert.equal(action.intelligenceFreshnessLabel, "Checked Mar 29");
  assert.equal(action.signalCount, 0);
  assert.match(action.recommendation, /No immediate intelligence-driven action/i);
});

test("buildActionProps returns watchlist state for heuristic-only dryness signals", () => {
  const readModel = {
    ...createBaseReadModel(),
    summary: {
      ...createBaseReadModel().summary,
      activeAlertCount: 0,
      activeFindingCount: 0,
      activeTrackedZoneCount: 0,
    },
    findings: [],
    alerts: [],
    zones: {
      zones: [],
      newZoneCount: 0,
      persistentZoneCount: 0,
      recoveringZoneCount: 0,
    },
    moisture: {
      latestSnapshot: {
        rootZonePct: 28.4,
        surfacePct: 17.9,
        confidence: "high",
        observedAt: "2026-03-29T09:30:00.000Z",
        sourceKey: "imagery-weather-derived-v1:sentinel-1",
      },
    },
    weather: {
      signals: {
        peakForecastVpdKpa24h: 0.7,
        frostRiskMinTempC: 6.2,
        netWaterBalance72hMm: -1.1,
        updatedAt: "2026-03-29T10:15:00.000Z",
        sourceKey: "open-meteo:derived",
      },
    },
  };

  const action = buildActionProps(readModel, "North Quarter Demo");

  assert.equal(action.intelligenceState, "watchlist");
  assert.equal(action.activeFindingCount, 0);
  assert.equal(action.activeZoneCount, 0);
  assert.match(action.topRiskTitle ?? "", /watch/i);
  assert.equal(action.intelligenceSourceLabel, "Heuristic watchlist");
  assert.equal(action.intelligenceFreshnessLabel, "Signals Mar 29");
  assert.match(action.recommendation, /Scout the driest part of the field/i);
  assert.equal(action.urgency, "Watch");
  assert.equal(action.signalCount, 1);
});

test("buildActionProps suppresses heuristic watchlists when field data quality is limited", () => {
  const readModel = {
    ...createBaseReadModel(),
    summary: {
      ...createBaseReadModel().summary,
      activeAlertCount: 0,
      activeFindingCount: 0,
      activeTrackedZoneCount: 0,
      dataQuality: {
        label: "Limited",
      },
    },
    findings: [],
    alerts: [],
    zones: {
      zones: [],
      newZoneCount: 0,
      persistentZoneCount: 0,
      recoveringZoneCount: 0,
    },
    moisture: {
      latestSnapshot: {
        rootZonePct: 28.4,
        surfacePct: 17.9,
        confidence: "high",
        observedAt: "2026-03-29T09:30:00.000Z",
        sourceKey: "imagery-weather-derived-v1:sentinel-1",
      },
    },
    weather: {
      signals: {
        peakForecastVpdKpa24h: 0.7,
        frostRiskMinTempC: 6.2,
        netWaterBalance72hMm: -1.1,
        updatedAt: "2026-03-29T10:15:00.000Z",
        sourceKey: "open-meteo:derived",
      },
    },
  };

  const action = buildActionProps(readModel, "North Quarter Demo");

  assert.equal(action.intelligenceState, "none");
  assert.equal(action.intelligenceSourceLabel, "No active intelligence");
  assert.equal(action.topRiskTitle, "No active intelligence signal");
  assert.match(action.recommendation, /current field context is not strong enough/i);
  assert.match(action.explanation, /heuristic watchlists stay suppressed/i);
  assert.match(action.questions[1]?.answer ?? "", /watchlist heuristics are being held back/i);
  assert.equal(action.signalCount, 0);
});

test("buildCropProps suppresses field-dependent disease and crop all-clear copy on limited fields", () => {
  const readModel = {
    ...createBaseReadModel(),
    summary: {
      ...createBaseReadModel().summary,
      dataQuality: {
        label: "Limited",
      },
    },
    findings: [],
    alerts: [],
    imagery: {},
    weather: {
      profile: {
        latestObservation: null,
      },
      signals: null,
    },
  };

  const crop = buildCropProps(readModel);

  assert.equal(crop.diseaseRisks[0]?.name, "Disease model held back");
  assert.match(crop.diseaseRisks[0]?.desc ?? "", /suppressed until field context is Ready/i);
  assert.equal(crop.alerts[0]?.title, "Field-dependent crop alerts held back");
  assert.match(crop.alerts[0]?.desc ?? "", /Only independent weather and hail alerts will surface/i);
});

test("buildCropProps keeps independent weather alerts visible on limited fields", () => {
  const readModel = {
    ...createBaseReadModel(),
    summary: {
      ...createBaseReadModel().summary,
      dataQuality: {
        label: "Limited",
      },
    },
    findings: [
      {
        id: "finding-1",
        family: "disease_risk",
        severity: "medium",
        title: "Blackleg watch",
        summary: "Humidity is supporting disease pressure.",
      },
    ],
    alerts: [
      {
        id: "alert-1",
        family: "moisture_stress",
        severity: "medium",
        title: "Moisture stress building",
        summary: "Drying is starting to spread.",
      },
      {
        id: "alert-2",
        family: "weather_risk",
        severity: "critical",
        title: "Critical frost risk next 24h",
        summary: "Forecast minimum breaches the frost threshold.",
      },
    ],
    imagery: {},
    weather: {
      profile: {
        latestObservation: null,
      },
      signals: null,
    },
  };

  const crop = buildCropProps(readModel);

  assert.equal(crop.diseaseRisks[0]?.name, "Disease model held back");
  assert.equal(crop.alerts.length, 1);
  assert.equal(crop.alerts[0]?.title, "Critical frost risk next 24h");
});

test("buildActivityPanelModel holds back field-dependent activity on limited fields", () => {
  const activity = buildActivityPanelModel({
    ...createBaseReadModel(),
    summary: {
      ...createBaseReadModel().summary,
      dataQuality: {
        label: "Limited",
      },
    },
    findings: [
      {
        id: "finding-1",
        family: "disease_risk",
        status: "active",
        severity: "medium",
        title: "Blackleg watch",
        summary: "Humidity is supporting disease pressure.",
        startedAt: "2026-03-28T00:00:00Z",
        evidence: { trackedZones: [{ zoneId: "zone-1" }] },
      },
      {
        id: "finding-2",
        family: "weather_risk",
        status: "active",
        severity: "critical",
        title: "Critical frost risk next 24h",
        summary: "Forecast minimum breaches the frost threshold.",
        startedAt: "2026-03-29T00:00:00Z",
        evidence: { trackedZones: [{ zoneId: "zone-2" }] },
      },
    ],
    zones: {
      zones: [
        {
          id: "zone-1",
          family: "disease_risk",
          trackingKey: "disease-1",
          status: "new",
          latestSeverity: "medium",
          affectedCellCount: 4,
          detectionCount: 2,
          lastSeenAt: "2026-03-28T00:00:00Z",
        },
        {
          id: "zone-2",
          family: "weather_risk",
          trackingKey: "weather-1",
          status: "new",
          latestSeverity: "critical",
          affectedCellCount: 6,
          detectionCount: 1,
          lastSeenAt: "2026-03-29T00:00:00Z",
        },
      ],
      familySummaries: [
        {
          family: "disease_risk",
          newZoneCount: 1,
          persistentZoneCount: 0,
          recoveringZoneCount: 0,
          totalZoneCount: 1,
        },
        {
          family: "weather_risk",
          newZoneCount: 1,
          persistentZoneCount: 0,
          recoveringZoneCount: 0,
          totalZoneCount: 1,
        },
      ],
    },
  });

  assert.equal(activity.dataQualityLabel, "Limited");
  assert.equal(activity.activeFindingCount, 1);
  assert.equal(activity.activeZoneCount, 1);
  assert.equal(activity.hiddenFindingCount, 1);
  assert.equal(activity.hiddenZoneCount, 1);
  assert.equal(activity.findings.length, 1);
  assert.equal(activity.findings[0]?.title, "Critical frost risk next 24h");
  assert.equal(activity.zones.length, 1);
  assert.equal(activity.zones[0]?.trackingKey, "weather-1");
  assert.deepEqual(
    activity.familySummaries.map((summary) => summary.family),
    ["weather_risk"],
  );
});

test("buildActionProps prioritizes spring seeding readiness over frost watch when seed-depth temperature is still missing", () => {
  const readModel = {
    ...createBaseReadModel(),
    summary: {
      ...createBaseReadModel().summary,
      activeAlertCount: 0,
      activeFindingCount: 0,
      activeTrackedZoneCount: 0,
    },
    findings: [],
    alerts: [],
    zones: {
      zones: [],
      newZoneCount: 0,
      persistentZoneCount: 0,
      recoveringZoneCount: 0,
    },
    weather: {
      signals: {
        frostRiskMinTempC: 5.4,
        frostRiskMinTempC7d: -1.8,
        frostRiskNights7d: 2,
        updatedAt: "2026-03-29T10:15:00.000Z",
        sourceKey: "open-meteo:derived",
      },
    },
  };

  const action = buildActionProps(readModel, "North Quarter Demo");

  assert.equal(action.intelligenceState, "watchlist");
  assert.equal(action.topRiskTitle, "Too early to seed");
  assert.equal(action.urgency, "Watch");
  assert.match(
    action.recommendation,
    /seed-depth soil temperature reaches 7°C for 3 consecutive days/i,
  );
  assert.equal(action.signalCount, 2);
  assert.match(action.signals[0]?.label ?? "", /Soil @ 6 cm pending/i);
  assert.match(action.signals[0]?.detail ?? "", /Target 7°C for 3d/i);
  assert.match(action.signals[1]?.label ?? "", /Frost min -1.8°C/);
  assert.match(action.signals[1]?.detail ?? "", /2 frost-risk nights next 7d/i);
  assert.match(
    action.questions[1]?.answer ?? "",
    /seed-depth soil temperature is still missing/i,
  );
});

test("buildActionProps deduplicates active signals while preserving active intelligence counts", () => {
  const readModel = {
    ...createBaseReadModel(),
    summary: {
      ...createBaseReadModel().summary,
      activeAlertCount: 1,
      activeFindingCount: 1,
      activeTrackedZoneCount: 0,
    },
    findings: [
      {
        id: "finding-1",
        family: "weather_risk",
        status: "active",
        severity: "critical",
        title: "Critical frost risk next 24h",
        summary: "Forecast minimum breaches the frost threshold.",
        recommendedAction: "Check crop stage sensitivity before the overnight low.",
        startedAt: "2026-03-28T00:00:00Z",
        evidence: { trackedZones: [] },
      },
    ],
    alerts: [
      {
        id: "alert-1",
        family: "weather_risk",
        status: "active",
        severity: "critical",
        title: "Critical frost risk next 24h",
        summary: "Forecast minimum breaches the frost threshold.",
        explanation: "Weather risk alert is active.",
        evidence: { trackedZoneIds: [] },
      },
    ],
    zones: {
      zones: [],
      newZoneCount: 0,
      persistentZoneCount: 0,
      recoveringZoneCount: 0,
    },
  };

  const action = buildActionProps(readModel, "North Quarter Demo");

  assert.equal(action.intelligenceState, "active");
  assert.equal(action.activeFindingCount, 1);
  assert.equal(action.activeAlertCount, 1);
  assert.equal(action.topRiskTitle, "Critical frost risk next 24h");
  assert.equal(action.intelligenceSourceLabel, "Finding-backed");
  assert.equal(action.intelligenceFreshnessLabel, "Updated Mar 28");
  assert.equal(
    action.signals.filter((signal) => signal.label === "weather risk").length,
    1,
  );
});

test("buildActionProps ranks the strongest active intelligence entry across findings and alerts", () => {
  const readModel = {
    ...createBaseReadModel(),
    summary: {
      ...createBaseReadModel().summary,
      activeAlertCount: 1,
      activeFindingCount: 1,
      activeTrackedZoneCount: 0,
    },
    findings: [
      {
        id: "finding-1",
        family: "moisture_stress",
        status: "active",
        severity: "medium",
        title: "Moisture stress building",
        summary: "Drying is starting to spread.",
        recommendedAction: "Check the driest cells on the next pass.",
        startedAt: "2026-03-28T00:00:00Z",
        updatedAt: "2026-03-28T10:00:00Z",
        evidence: { trackedZones: [{ id: "zone-1" }] },
      },
    ],
    alerts: [
      {
        id: "alert-1",
        family: "weather_risk",
        status: "active",
        severity: "critical",
        title: "Critical frost risk next 24h",
        summary: "Forecast minimum breaches the frost threshold.",
        recommendedAction: "Protect frost-sensitive areas before the overnight low.",
        updatedAt: "2026-03-29T04:00:00Z",
        evidence: { trackedZoneIds: [] },
      },
    ],
    zones: {
      zones: [],
      newZoneCount: 0,
      persistentZoneCount: 0,
      recoveringZoneCount: 0,
    },
  };

  const action = buildActionProps(readModel, "North Quarter Demo");

  assert.equal(action.intelligenceState, "active");
  assert.equal(action.topRiskTitle, "Critical frost risk next 24h");
  assert.equal(action.urgency, "Urgent");
  assert.equal(action.intelligenceSource, "alerts");
  assert.equal(action.intelligenceSourceLabel, "Alert-backed");
});

test("buildActionProps applies matching cached field-action curation without changing the active risk contract", () => {
  const readModel = {
    ...createBaseReadModel(),
    findings: [
      {
        id: "finding-1",
        family: "weather_risk",
        status: "active",
        severity: "critical",
        title: "Critical frost risk next 24h",
        summary: "Forecast minimum breaches the frost threshold.",
        recommendedAction: "Protect frost-sensitive areas before the overnight low.",
        updatedAt: "2026-03-29T04:00:00Z",
        evidence: { trackedZones: [] },
      },
    ],
    alerts: [],
    zones: {
      zones: [],
      newZoneCount: 0,
      persistentZoneCount: 0,
      recoveringZoneCount: 0,
    },
    summary: {
      ...createBaseReadModel().summary,
      activeAlertCount: 0,
      activeFindingCount: 1,
      activeTrackedZoneCount: 0,
    },
  };

  const version = buildFieldActionCurationVersion({
    state: "active",
    source: "findings",
    topRiskTitle: "Critical frost risk next 24h",
    topRiskSeverity: "critical",
    dueDate: "Within 24h",
    activeFindingCount: 1,
    activeZoneCount: 0,
    activeAlertCount: 0,
  });

  const action = buildActionProps(readModel, "North Quarter Demo", {
    curation: {
      inputVersion: version,
      generatedAt: "2026-03-30T10:15:00Z",
      provider: "google-gemini",
      modelKey: "gemini-2.5-flash",
      recommendation: "Check frost-prone pockets before the overnight low and confirm stage sensitivity before acting field-wide.",
      explanation: "Active frost intelligence is leading the action card. The rewrite should stay concise but grounded in the same risk.",
      inspectFirst: "Start with low spots and exposed edges where frost settles first.",
      whyNow: "The active frost signal is critical and time-bound to the next overnight window.",
      supportingContext: "This wording is still grounded in the active weather-risk finding and current signal counts.",
      confidence: "Finding-backed",
    },
  });

  assert.equal(action.topRiskTitle, "Critical frost risk next 24h");
  assert.equal(action.recommendation, "Check frost-prone pockets before the overnight low and confirm stage sensitivity before acting field-wide.");
  assert.equal(action.explanation, "Active frost intelligence is leading the action card. The rewrite should stay concise but grounded in the same risk.");
  assert.equal(action.questions[0]?.answer, "Start with low spots and exposed edges where frost settles first.");
  assert.equal(action.questions[1]?.answer, "The active frost signal is critical and time-bound to the next overnight window.");
  assert.equal(action.questions[2]?.answer, "This wording is still grounded in the active weather-risk finding and current signal counts.");
  assert.equal(action.confidence, "Finding-backed");
});

// ---------------------------------------------------------------------------
// resolveHistoricalAnomalyFromReadModel
// ---------------------------------------------------------------------------

test("resolveHistoricalAnomalyFromReadModel returns anomaly object when read model has percentile data", () => {
  const result = resolveHistoricalAnomalyFromReadModel({
    historicalAnomalyPercentile: 82,
    historicalAnomalyDescription: "Drier than 82% of years for early April",
  });

  assert.deepEqual(result, {
    percentile: 82,
    description: "Drier than 82% of years for early April",
    anomalyClass: "unusually-dry",
  });
});

test("resolveHistoricalAnomalyFromReadModel classifies low percentile as unusually-wet", () => {
  const result = resolveHistoricalAnomalyFromReadModel({
    historicalAnomalyPercentile: 18,
    historicalAnomalyDescription: "Wetter than 82% of years for mid March",
  });

  assert.equal(result!.anomalyClass, "unusually-wet");
  assert.equal(result!.percentile, 18);
});

test("resolveHistoricalAnomalyFromReadModel classifies mid-range percentile as normal", () => {
  const result = resolveHistoricalAnomalyFromReadModel({
    historicalAnomalyPercentile: 50,
    historicalAnomalyDescription: "Within normal range for late June",
  });

  assert.equal(result!.anomalyClass, "normal");
});

test("resolveHistoricalAnomalyFromReadModel returns null when percentile is missing", () => {
  const result = resolveHistoricalAnomalyFromReadModel({});
  assert.equal(result, null);
});

test("resolveHistoricalAnomalyFromReadModel returns null when percentile is null", () => {
  const result = resolveHistoricalAnomalyFromReadModel({
    historicalAnomalyPercentile: null,
    historicalAnomalyDescription: "Should not appear",
  });
  assert.equal(result, null);
});

test("resolveHistoricalAnomalyFromReadModel returns null when description is absent", () => {
  const result = resolveHistoricalAnomalyFromReadModel({
    historicalAnomalyPercentile: 60,
  });

  assert.equal(result, null);
});

test("resolveHistoricalAnomalyFromReadModel returns null when description is blank", () => {
  const result = resolveHistoricalAnomalyFromReadModel({
    historicalAnomalyPercentile: 60,
    historicalAnomalyDescription: "   ",
  });

  assert.equal(result, null);
});

test("resolveHistoricalAnomalyFromReadModel boundary: percentile exactly 75 is normal", () => {
  const result = resolveHistoricalAnomalyFromReadModel({
    historicalAnomalyPercentile: 75,
    historicalAnomalyDescription: "Within normal range for early April",
  });
  assert.equal(result!.anomalyClass, "normal");
});

test("resolveHistoricalAnomalyFromReadModel boundary: percentile exactly 25 is normal", () => {
  const result = resolveHistoricalAnomalyFromReadModel({
    historicalAnomalyPercentile: 25,
    historicalAnomalyDescription: "Within normal range for early April",
  });
  assert.equal(result!.anomalyClass, "normal");
});

/* ── deriveSummaryStatusLabel ── */

test("deriveSummaryStatusLabel: depletionPct 10 → Adequate", () => {
  assert.equal(deriveSummaryStatusLabel(10, null), "Adequate");
});

test("deriveSummaryStatusLabel: depletionPct 30 → Adequate (boundary)", () => {
  assert.equal(deriveSummaryStatusLabel(30, null), "Adequate");
});

test("deriveSummaryStatusLabel: depletionPct 31 → Watch", () => {
  assert.equal(deriveSummaryStatusLabel(31, null), "Watch");
});

test("deriveSummaryStatusLabel: depletionPct 50 → Watch (boundary)", () => {
  assert.equal(deriveSummaryStatusLabel(50, null), "Watch");
});

test("deriveSummaryStatusLabel: depletionPct 51 → Stress", () => {
  assert.equal(deriveSummaryStatusLabel(51, null), "Stress");
});

test("deriveSummaryStatusLabel: depletionPct 75 → Stress (boundary)", () => {
  assert.equal(deriveSummaryStatusLabel(75, null), "Stress");
});

test("deriveSummaryStatusLabel: depletionPct 76 → Critical", () => {
  assert.equal(deriveSummaryStatusLabel(76, null), "Critical");
});

test("deriveSummaryStatusLabel: depletionPct null falls back to rootZonePct 65 → Adequate", () => {
  assert.equal(deriveSummaryStatusLabel(null, 65), "Adequate");
});

test("deriveSummaryStatusLabel: depletionPct null falls back to rootZonePct 45 → Watch", () => {
  assert.equal(deriveSummaryStatusLabel(null, 45), "Watch");
});

test("deriveSummaryStatusLabel: depletionPct null falls back to rootZonePct 25 → Stress", () => {
  assert.equal(deriveSummaryStatusLabel(null, 25), "Stress");
});

test("deriveSummaryStatusLabel: depletionPct null falls back to rootZonePct 10 → Critical", () => {
  assert.equal(deriveSummaryStatusLabel(null, 10), "Critical");
});

test("deriveSummaryStatusLabel: both null → undefined", () => {
  assert.equal(deriveSummaryStatusLabel(null, null), undefined);
});

test("deriveSummaryStatusLabel: depletionPct takes priority over rootZonePct", () => {
  // depletionPct 80 → Critical even though rootZonePct 65 would be Adequate
  assert.equal(deriveSummaryStatusLabel(80, 65), "Critical");
});

/* ── deriveSummaryConfidenceBreakdown ── */

test("deriveSummaryConfidenceBreakdown: maps provenance fields correctly", () => {
  const result = deriveSummaryConfidenceBreakdown({
    inputs: {
      freshnessFactor: 0.9,
      agreementFlag: true,
      resolutionTier: "high",
      scaleFitScore: 0.85,
    },
  });
  assert.ok(result);
  assert.equal(result.freshness, "Fresh (< 6h)");
  assert.equal(result.agreement, "Signals agree");
  assert.equal(result.resolution, "Sub-field (10m)");
  assert.equal(result.scaleFit, "Well-matched");
});

test("deriveSummaryConfidenceBreakdown: stale freshness factor", () => {
  const result = deriveSummaryConfidenceBreakdown({
    inputs: {
      freshnessFactor: 0.1,
      agreementFlag: false,
      resolutionTier: "low",
      scaleFitScore: 0.3,
    },
  });
  assert.ok(result);
  assert.equal(result.freshness, "Stale (> 3d)");
  assert.equal(result.agreement, "Signals diverge");
  assert.equal(result.resolution, "Regional (250m+)");
  assert.equal(result.scaleFit, "Poor fit");
});

test("deriveSummaryConfidenceBreakdown: medium resolution and acceptable scale", () => {
  const result = deriveSummaryConfidenceBreakdown({
    inputs: {
      freshnessFactor: 0.6,
      agreementFlag: true,
      resolutionTier: "medium",
      scaleFitScore: 0.6,
    },
  });
  assert.ok(result);
  assert.equal(result.freshness, "Recent (< 24h)");
  assert.equal(result.resolution, "Field-level (30m)");
  assert.equal(result.scaleFit, "Acceptable");
});

test("deriveSummaryConfidenceBreakdown: scaleFitLabel overrides score", () => {
  const result = deriveSummaryConfidenceBreakdown({
    inputs: {
      freshnessFactor: 0.9,
      agreementFlag: true,
      resolutionTier: "sub-field",
      scaleFitLabel: "Precision-mapped",
      scaleFitScore: 0.3, // would produce "Poor fit" but label overrides
    },
  });
  assert.ok(result);
  assert.equal(result.scaleFit, "Precision-mapped");
});

test("deriveSummaryConfidenceBreakdown: null when no inputs", () => {
  assert.equal(deriveSummaryConfidenceBreakdown(null), null);
  assert.equal(deriveSummaryConfidenceBreakdown({}), null);
  assert.equal(deriveSummaryConfidenceBreakdown(undefined), null);
});

test("deriveSummaryConfidenceBreakdown: defaults to Unknown for missing sub-fields", () => {
  const result = deriveSummaryConfidenceBreakdown({ inputs: {} });
  assert.ok(result);
  assert.equal(result.freshness, "Unknown");
  assert.equal(result.agreement, "Unknown");
  assert.equal(result.resolution, "Unknown");
  assert.equal(result.scaleFit, "Unknown");
});

/* ── deriveSummaryDataSources ── */

test("deriveSummaryDataSources: identifies Sentinel-1 satellite source", () => {
  const result = deriveSummaryDataSources(
    { sourceKey: "sentinel-hub-stats-v1:sentinel-1" },
    { latestObservation: true, forecasts: true },
  );
  assert.ok(result);
  assert.equal(result.satellite, "Sentinel-1 (SAR)");
  assert.equal(result.weather, "Available");
  assert.equal(result.soil, null);
});

test("deriveSummaryDataSources: identifies Sentinel-2 satellite source", () => {
  const result = deriveSummaryDataSources(
    { sourceKey: "sentinel-hub:sentinel-2" },
    { latestObservation: false, forecasts: false },
  );
  assert.ok(result);
  assert.equal(result.satellite, "Sentinel-2 (Optical)");
  assert.equal(result.weather, null);
});

test("deriveSummaryDataSources: identifies Planet satellite source", () => {
  const result = deriveSummaryDataSources(
    { sourceKey: "planet-scope:planet-daily" },
    null,
  );
  assert.ok(result);
  assert.equal(result.satellite, "Planet (Optical)");
});

test("deriveSummaryDataSources: null when both snapshot and weather are absent", () => {
  assert.equal(deriveSummaryDataSources(null, null), null);
  assert.equal(deriveSummaryDataSources(undefined, undefined), null);
});

test("deriveSummaryDataSources: weather only when no snapshot", () => {
  const result = deriveSummaryDataSources(null, { latestObservation: true });
  assert.ok(result);
  assert.equal(result.satellite, null);
  assert.equal(result.weather, "Available");
});

test("deriveSummaryDataSources: exposes soil dataset label when present", () => {
  const result = deriveSummaryDataSources(
    {
      sourceKey: "sentinel-hub:sentinel-2",
      inputs: {
        soilDataset: "SoilGrids-v2",
      },
    },
    null,
  );
  assert.ok(result);
  assert.equal(result.soil, "SoilGrids");
});

/* ── deriveSummaryDataQuality ── */

test("deriveSummaryDataQuality: returns Ready for fresh source-backed field with depth", () => {
  const result = deriveSummaryDataQuality({
    snapshot: {
      confidence: "high",
      observedAt: "2099-04-01T10:00:00Z",
      inputs: {
        derivationMode: "source-backed",
        signalBlend: "raster+weather",
        rasterMode: "provider",
        freshnessFactor: 0.9,
        baselineDataset: "ERA5-Land",
        usedWeatherSoilMoisture: true,
      },
    },
    confidence: "high",
    weatherAvailability: { latestObservation: true, forecasts: true },
    opticalObservationCount: 3,
  });
  assert.ok(result);
  assert.equal(result.label, "Ready");
  assert.equal(result.tone, "positive");
});

test("deriveSummaryDataQuality: returns Limited when optical history is thin", () => {
  const result = deriveSummaryDataQuality({
    snapshot: {
      confidence: "high",
      observedAt: "2099-04-01T10:00:00Z",
      inputs: {
        derivationMode: "source-backed",
        signalBlend: "raster+weather",
        rasterMode: "provider",
        freshnessFactor: 0.9,
        soilDataset: "SoilGrids",
        usedWeatherSoilMoisture: true,
      },
    },
    confidence: "high",
    weatherAvailability: { latestObservation: true, forecasts: true },
    opticalObservationCount: 1,
  });
  assert.ok(result);
  assert.equal(result.label, "Limited");
  assert.match(result.summary, /vegetation history/i);
});

test("deriveSummaryDataQuality: returns Modeled for seeded fallback", () => {
  const result = deriveSummaryDataQuality({
    snapshot: {
      confidence: "low",
      inputs: {
        derivationMode: "seeded-range",
        signalBlend: "seeded",
        rasterMode: "none",
      },
    },
    confidence: "low",
    weatherAvailability: null,
    opticalObservationCount: 0,
  });
  assert.ok(result);
  assert.equal(result.label, "Modeled");
  assert.equal(result.tone, "danger");
});

test("deriveSummaryDataQuality: returns Stale for old source-backed readings", () => {
  const result = deriveSummaryDataQuality({
    snapshot: {
      confidence: "medium",
      observedAt: "2026-03-20T10:00:00Z",
      inputs: {
        derivationMode: "source-backed",
        signalBlend: "raster-only",
        rasterMode: "provider",
        freshnessFactor: 0.1,
        baselineDataset: "ERA5-Land",
      },
    },
    confidence: "medium",
    weatherAvailability: { latestObservation: true },
    opticalObservationCount: 2,
  });
  assert.ok(result);
  assert.equal(result.label, "Stale");
  assert.equal(result.tone, "muted");
});

test("buildEffectiveMoistureSummary preserves snapshot inputs for provenance mapping", () => {
  const inputs = {
    depletionPct: 28.3,
    freshnessFactor: 0.91,
    rasterAgeHours: 4.5,
    agreementFlag: "agree" as const,
    resolutionTier: "sub-field" as const,
    availableWaterMm: 52.0,
    rootZoneDepthCm: 30,
    derivationMode: "source-backed" as const,
    confidenceScore: 0.88,
  };

  const summary = buildEffectiveMoistureSummary({
    moisture: {
      latestSnapshot: {
        rootZonePct: 44.1,
        surfacePct: 31.2,
        confidence: "high",
        sourceKey: "sentinel-hub-stats-v1:sentinel-1",
        observedAt: "2026-03-28T08:00:00Z",
        inputs,
      },
      latestCells: [],
    },
    imagery: {},
  });

  assert.ok(summary.latestSnapshot, "snapshot should exist");
  assert.ok(summary.latestSnapshot.inputs, "snapshot should preserve inputs");
  assert.equal(summary.latestSnapshot.inputs.depletionPct, 28.3);
  assert.equal(summary.latestSnapshot.inputs.freshnessFactor, 0.91);
  assert.equal(summary.latestSnapshot.inputs.rasterAgeHours, 4.5);
  assert.equal(summary.latestSnapshot.inputs.agreementFlag, "agree");
  assert.equal(summary.latestSnapshot.inputs.resolutionTier, "sub-field");
  assert.equal(summary.latestSnapshot.inputs.availableWaterMm, 52.0);
  assert.equal(summary.latestSnapshot.inputs.rootZoneDepthCm, 30);
});
