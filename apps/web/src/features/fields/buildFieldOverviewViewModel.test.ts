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
} from "./buildFieldOverviewViewModel";
import { buildActionProps } from "./buildFieldOverviewViewModel.action";
import { resolveHistoricalAnomalyFromReadModel } from "./buildFieldOverviewViewModel.shared";

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

test("resolveHistoricalAnomalyFromReadModel defaults description to empty string when absent", () => {
  const result = resolveHistoricalAnomalyFromReadModel({
    historicalAnomalyPercentile: 60,
  });

  assert.equal(result!.description, "");
  assert.equal(result!.anomalyClass, "normal");
});

test("resolveHistoricalAnomalyFromReadModel boundary: percentile exactly 75 is normal", () => {
  const result = resolveHistoricalAnomalyFromReadModel({
    historicalAnomalyPercentile: 75,
  });
  assert.equal(result!.anomalyClass, "normal");
});

test("resolveHistoricalAnomalyFromReadModel boundary: percentile exactly 25 is normal", () => {
  const result = resolveHistoricalAnomalyFromReadModel({
    historicalAnomalyPercentile: 25,
  });
  assert.equal(result!.anomalyClass, "normal");
});
