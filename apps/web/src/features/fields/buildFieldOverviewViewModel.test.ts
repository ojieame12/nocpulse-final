import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEffectiveMoistureSummary,
  buildMarketProps,
  buildReportProps,
  resolveCanopySignalPresentation,
  resolveCropStagePresentation,
  resolveOpticalSeasonality,
} from "./buildFieldOverviewViewModel";

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
  assert.equal(presentation.gddUnitLabel, "Season GDD unavailable (base 5°C)");
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
  assert.equal(presentation.actionConfidenceLabel, "Vegetative optical");
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
