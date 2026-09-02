import assert from "node:assert/strict";
import test from "node:test";
import {
  prairieDefaultRulePack,
  resolveCropRuleContext,
} from "@fieldpulse/module-crop-intelligence";
import type { FieldCropContext } from "@fieldpulse/module-field-crop-context";
import type { FieldDetail } from "@fieldpulse/module-fields";
import type { FieldMoistureSnapshot } from "@fieldpulse/module-moisture";
import {
  buildFieldReportPdfRenderInput,
  type FieldReportReadModel,
} from "@fieldpulse/module-reports";
import type {
  FieldWeatherDerivedSignalSet,
  FieldWeatherForecast,
  FieldWeatherProfile,
} from "@fieldpulse/module-weather";
import { buildReportProps } from "./buildFieldOverviewViewModel.report";
import { resolveFieldAccessPresentation, resolveSeedingRecommendation } from "./buildFieldOverviewViewModel.spring";
import { resolveSprayWindowRecommendation } from "./buildFieldOverviewViewModel.spray";

const FIELD = {
  id: "field-1",
  workspaceId: "workspace-1",
  name: "North Quarter",
  areaHa: 64.2,
  legalLandDescription: "SW-1-1-1-W1",
  boundary: {
    type: "MultiPolygon",
    coordinates: [
      [
        [
          [-106.7, 52.1],
          [-106.6, 52.1],
          [-106.6, 52.2],
          [-106.7, 52.2],
          [-106.7, 52.1],
        ],
      ],
    ],
  },
  labelPoint: [-106.67, 52.13],
  createdBy: "user-1",
  createdAt: "2026-03-01T00:00:00.000Z",
  updatedAt: "2026-03-01T00:00:00.000Z",
} satisfies FieldDetail;

const PRESEED_STAGE = {
  displayStageLabel: "Pre Seed",
  ruleStage: "pre-seed",
  thresholdStageLabel: "Pre Seed stage",
  accumulatedGddLabel: "—",
  gddUnitLabel: "Season heat units unavailable (base 5°C)",
  stageSourceLabel: "Weather-derived stage still initializing",
  hasCredibleAccumulatedGdd: false,
} as const;

function normalizeSeedingDecisionTitle(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/\s+—\s+.+$/, "")
    .trim();
}

function createHourlyForecast(input: {
  validAt: string;
  airTemperatureC: number;
  windSpeedKph?: number;
  precipitationMm?: number;
  precipitationProbabilityPct?: number | null;
}): FieldWeatherForecast {
  return {
    id: `forecast-${input.validAt}`,
    workspaceId: "workspace-1",
    fieldId: "field-1",
    forecastRunAt: "2026-04-03T12:00:00.000Z",
    validAt: input.validAt,
    sourceKey: "open-meteo:hourly-v1",
    providerKey: "open-meteo",
    airTemperatureMinC: input.airTemperatureC,
    airTemperatureMaxC: input.airTemperatureC,
    precipitationMm: input.precipitationMm ?? 0,
    windSpeedKph: input.windSpeedKph ?? 12,
    relativeHumidityPct: 60,
    evapotranspirationMm: 0.2,
    precipitationProbabilityPct: input.precipitationProbabilityPct ?? 10,
    createdAt: input.validAt,
    updatedAt: input.validAt,
  };
}

function createSignalSet(input: {
  soilTemp6cmCurrentC: number | null;
  soilTemp6cmSustainedDays: number | null;
  frostRiskMinTempC7d: number | null;
  frostRiskNights7d: number | null;
  frostProbabilityPct7d: number | null;
  sprayWindowCount24h?: number | null;
  recentPrecipTotal72hMm?: number | null;
  freezeThawCycles7d?: number | null;
}): FieldWeatherDerivedSignalSet {
  return {
    id: "signals-1",
    workspaceId: "workspace-1",
    fieldId: "field-1",
    weatherObservationId: null,
    observedAt: "2026-04-03T12:00:00.000Z",
    forecastRunAt: "2026-04-03T12:00:00.000Z",
    sourceKey: "open-meteo:hourly-v1",
    providerKey: "open-meteo",
    signalVersion: "v1",
    currentVpdKpa: null,
    peakForecastVpdKpa24h: null,
    netWaterBalance24hMm: null,
    netWaterBalance72hMm: null,
    leafWetHours24h: 0,
    sprayWindowCount24h: input.sprayWindowCount24h ?? 0,
    frostRiskMinTempC: input.frostRiskMinTempC7d,
    frostRiskMinTempC7d: input.frostRiskMinTempC7d,
    frostRiskNights7d: input.frostRiskNights7d,
    frostProbabilityPct7d: input.frostProbabilityPct7d,
    recentPrecipTotal72hMm: input.recentPrecipTotal72hMm ?? 4,
    freezeThawCycles7d: input.freezeThawCycles7d ?? 1,
    soilTemp6cmCurrentC: input.soilTemp6cmCurrentC,
    soilTemp6cmSustainedDays: input.soilTemp6cmSustainedDays,
    gdd24h: null,
    gdd72h: null,
    gddBaseC: 5,
    provenance: {},
    createdAt: "2026-04-03T12:00:00.000Z",
    updatedAt: "2026-04-03T12:00:00.000Z",
  };
}

function createSnapshot(surfacePct: number): FieldMoistureSnapshot {
  return {
    id: "snapshot-1",
    workspaceId: "workspace-1",
    fieldId: "field-1",
    observedAt: "2026-04-03T12:00:00.000Z",
    sourceKey: "overview-rebuild",
    rootZonePct: 55,
    surfacePct,
    confidence: "high",
    inputs: {},
    createdAt: "2026-04-03T12:00:00.000Z",
  };
}

function createCropContext(cropType: string, growthStage = "Pre Seed"): FieldCropContext {
  return {
    id: "crop-1",
    workspaceId: "workspace-1",
    fieldId: "field-1",
    seasonYear: 2026,
    cropType,
    growthStage,
    growthStageSource: "derived",
    accumulatedGdd: 0,
    lastGddObservedOn: null,
    lastWeatherSignalSetId: "signals-1",
    lastStageUpdatedAt: "2026-04-03T12:00:00.000Z",
    sourceKey: "weather-derived",
    metadata: {},
    createdAt: "2026-04-03T12:00:00.000Z",
    updatedAt: "2026-04-03T12:00:00.000Z",
  };
}

function createReadModel(input: {
  cropType: string;
  signalSet: FieldWeatherDerivedSignalSet;
  surfacePct: number;
  forecasts?: FieldWeatherProfile["forecasts"];
}): FieldReportReadModel {
  const profile: FieldWeatherProfile = {
    latestObservation: null,
    forecasts: input.forecasts ?? [],
    dataAvailability: {
      latestObservation: false,
      forecasts: (input.forecasts?.length ?? 0) > 0,
    },
  };

  return {
    generatedAt: "2026-04-03T12:00:00.000Z",
    reportDate: "2026-04-03T00:00:00.000Z",
    field: FIELD,
    cropContext: createCropContext(input.cropType),
    intake: {
      latestCommittedCandidate: null,
      legalLandDescription: FIELD.legalLandDescription,
    },
    imagery: {
      latestRasterObservation: null,
      latestCellCount: 0,
      latestObservedAt: null,
      latestSourceKey: null,
      latestProviderKey: null,
    },
    moisture: {
      latestSnapshot: createSnapshot(input.surfacePct),
      latestCells: [],
      latestCellCount: 0,
      lowConfidenceCellCount: 0,
      rootZoneMinPct: null,
      rootZoneMaxPct: null,
      rootZoneAvgPct: null,
      surfaceMinPct: null,
      surfaceMaxPct: null,
      surfaceAvgPct: null,
      recentSnapshots: [],
    },
    weather: {
      profile,
      signals: input.signalSet,
      recentObservations: [],
    },
    dataAvailability: {
      activeAlerts: false,
      resolvedAlerts: false,
    },
    alerts: [],
    resolvedAlerts: [],
    findings: [],
    zones: {
      generatedAt: "2026-04-03T12:00:00.000Z",
      workspaceId: "workspace-1",
      fieldId: "field-1",
      totalZoneCount: 0,
      newZoneCount: 0,
      persistentZoneCount: 0,
      recoveringZoneCount: 0,
      resolvedZoneCount: 0,
      familySummaries: [],
      zones: [],
    },
    summary: {
      cropType: input.cropType,
      growthStage: "Pre Seed",
      activeAlertCount: 0,
      activeFindingCount: 0,
      trackedZoneCount: 0,
      activeTrackedZoneCount: 0,
      moistureObservedAt: "2026-04-03T12:00:00.000Z",
      weatherObservedAt: "2026-04-03T12:00:00.000Z",
    },
  };
}

function findSeedingCard(readModel: FieldReportReadModel) {
  const renderInput = buildFieldReportPdfRenderInput({
    artifactKey: "test-artifact",
    readModel,
  });
  const seedingHeaderIndex = renderInput.blocks.findIndex(
    (block) => block.kind === "section-header" && block.label === "Seeding Intelligence",
  );

  assert.notEqual(seedingHeaderIndex, -1);

  return renderInput.blocks
    .slice(seedingHeaderIndex + 1)
    .find((block) => block.kind === "severity-card");
}

function findSprayBlocks(readModel: FieldReportReadModel) {
  const renderInput = buildFieldReportPdfRenderInput({
    artifactKey: "test-artifact",
    readModel,
  });
  const sprayHeaderIndex = renderInput.blocks.findIndex(
    (block) => block.kind === "section-header" && block.label === "Spray Windows",
  );

  assert.notEqual(sprayHeaderIndex, -1);

  const sprayBlocks = renderInput.blocks.slice(sprayHeaderIndex + 1);
  return {
    table: sprayBlocks.find(
      (block) =>
        block.kind === "table" &&
        block.columns[0]?.label === "Window" &&
        block.columns[1]?.label === "Start",
    ),
    card: sprayBlocks.find((block) => block.kind === "severity-card"),
  };
}

function findForecastTable(readModel: FieldReportReadModel) {
  const renderInput = buildFieldReportPdfRenderInput({
    artifactKey: "test-artifact",
    readModel,
  });

  return renderInput.blocks.find(
    (block) => block.kind === "table" && block.columns[0]?.label === "Day",
  );
}

test("UI and PDF stay aligned on too-early canola seeding decisions", () => {
  const cropType = "Canola";
  const ruleContext = resolveCropRuleContext({
    rulePack: prairieDefaultRulePack,
    cropContext: createCropContext(cropType),
  });
  const soilTemp6cmCurrentC = 4.8;
  const soilTemp6cmSustainedDays = 0;
  const surfacePct = 58;
  const frostRiskMinTempC7d = 2.5;
  const frostRiskNights7d = 0;
  const frostProbabilityPct7d = 8;
  const fieldAccessPresentation = resolveFieldAccessPresentation({
    surfaceMoisturePct: surfacePct,
    recentPrecipTotal72hMm: 4,
    freezeThawCycles7d: 1,
    thresholds: ruleContext.seedingThresholds,
  });
  const uiRecommendation = resolveSeedingRecommendation({
    cropLabel: cropType,
    cropStagePresentation: PRESEED_STAGE,
    seedingThresholds: ruleContext.seedingThresholds,
    frostDamageTempC: ruleContext.weatherRisk.frost.damageTempC,
    frostKillTempC: ruleContext.weatherRisk.frost.killTempC,
    soilTemp6cmCurrentC,
    soilTemp6cmSustainedDays,
    surfaceMoisturePct: surfacePct,
    fieldAccessPresentation,
    frostRiskMinTempC7d,
    frostRiskNights7d,
    frostProbabilityPct7d,
    weatherSourceLabel: "open-meteo · hourly-v1",
  });
  const pdfCard = findSeedingCard(
    createReadModel({
      cropType,
      surfacePct,
      signalSet: createSignalSet({
        soilTemp6cmCurrentC,
        soilTemp6cmSustainedDays,
        frostRiskMinTempC7d,
        frostRiskNights7d,
        frostProbabilityPct7d,
      }),
    }),
  );

  assert.equal(normalizeSeedingDecisionTitle(uiRecommendation?.title), "too early to seed");
  assert.equal(normalizeSeedingDecisionTitle(pdfCard?.title), "too early to seed");
  assert.match(uiRecommendation?.recommendation ?? "", /7°C/i);
  assert.match(pdfCard?.body ?? "", /7°C/i);
});

test("UI and PDF stay aligned on frost-hold wheat seeding decisions", () => {
  const cropType = "Wheat";
  const ruleContext = resolveCropRuleContext({
    rulePack: prairieDefaultRulePack,
    cropContext: createCropContext(cropType),
  });
  const soilTemp6cmCurrentC = 6.4;
  const soilTemp6cmSustainedDays = 3;
  const surfacePct = 61;
  const frostRiskMinTempC7d = -2.5;
  const frostRiskNights7d = 1;
  const frostProbabilityPct7d = 43;
  const fieldAccessPresentation = resolveFieldAccessPresentation({
    surfaceMoisturePct: surfacePct,
    recentPrecipTotal72hMm: 4,
    freezeThawCycles7d: 1,
    thresholds: ruleContext.seedingThresholds,
  });
  const uiRecommendation = resolveSeedingRecommendation({
    cropLabel: cropType,
    cropStagePresentation: PRESEED_STAGE,
    seedingThresholds: ruleContext.seedingThresholds,
    frostDamageTempC: ruleContext.weatherRisk.frost.damageTempC,
    frostKillTempC: ruleContext.weatherRisk.frost.killTempC,
    soilTemp6cmCurrentC,
    soilTemp6cmSustainedDays,
    surfaceMoisturePct: surfacePct,
    fieldAccessPresentation,
    frostRiskMinTempC7d,
    frostRiskNights7d,
    frostProbabilityPct7d,
    weatherSourceLabel: "open-meteo · hourly-v1",
  });
  const pdfCard = findSeedingCard(
    createReadModel({
      cropType,
      surfacePct,
      signalSet: createSignalSet({
        soilTemp6cmCurrentC,
        soilTemp6cmSustainedDays,
        frostRiskMinTempC7d,
        frostRiskNights7d,
        frostProbabilityPct7d,
      }),
    }),
  );

  assert.equal(normalizeSeedingDecisionTitle(uiRecommendation?.title), "hold seeding for frost risk");
  assert.equal(normalizeSeedingDecisionTitle(pdfCard?.title), "hold seeding for frost risk");
  assert.match(uiRecommendation?.whyNow ?? "", /-2\.5°C/i);
  assert.match(pdfCard?.body ?? "", /-2\.5°C/i);
  assert.match(uiRecommendation?.whyNow ?? "", /43% probability/i);
  assert.match(pdfCard?.body ?? "", /43% probability/i);
});

test("UI and PDF stay aligned on farmer-local spray window timing", () => {
  const forecasts = [
    createHourlyForecast({ validAt: "2026-04-02T13:00:00.000Z", airTemperatureC: 8, windSpeedKph: 10 }),
    createHourlyForecast({ validAt: "2026-04-02T14:00:00.000Z", airTemperatureC: 12 }),
    createHourlyForecast({ validAt: "2026-04-02T15:00:00.000Z", airTemperatureC: 14 }),
    createHourlyForecast({ validAt: "2026-04-02T16:00:00.000Z", airTemperatureC: 16 }),
    createHourlyForecast({ validAt: "2026-04-02T17:00:00.000Z", airTemperatureC: 17 }),
    createHourlyForecast({ validAt: "2026-04-02T18:00:00.000Z", airTemperatureC: 18 }),
    createHourlyForecast({ validAt: "2026-04-02T19:00:00.000Z", airTemperatureC: 17 }),
    createHourlyForecast({ validAt: "2026-04-02T20:00:00.000Z", airTemperatureC: 15 }),
  ];
  const uiRecommendation = resolveSprayWindowRecommendation({
    cropLabel: "Canola",
    sprayWindowCount24h: 1,
    forecasts,
    fieldLabelPoint: FIELD.labelPoint,
    weatherSourceLabel: "open-meteo · hourly-v1",
  });
  const pdfSprayBlocks = findSprayBlocks(
    createReadModel({
      cropType: "Canola",
      surfacePct: 58,
      signalSet: createSignalSet({
        soilTemp6cmCurrentC: 5.2,
        soilTemp6cmSustainedDays: 2,
        frostRiskMinTempC7d: 1.5,
        frostRiskNights7d: 1,
        frostProbabilityPct7d: 25,
        sprayWindowCount24h: 1,
      }),
      forecasts,
    }),
  );

  const detail = uiRecommendation?.signals[0]?.detail ?? "";
  const [startLabel = "", remainder = ""] = detail.split(" to ");
  const [endLabel = ""] = remainder.split(" · ");

  assert.equal(uiRecommendation?.title, "Spray window open");
  assert.match(detail, /CST/);
  assert.equal(pdfSprayBlocks.table?.kind, "table");
  assert.equal(pdfSprayBlocks.card?.kind, "severity-card");
  assert.equal(pdfSprayBlocks.table?.rows[0]?.cells[1], startLabel);
  assert.equal(pdfSprayBlocks.table?.rows[0]?.cells[2], endLabel);
  assert.equal(pdfSprayBlocks.card?.title, `Best window: ${startLabel} – ${endLabel}`);
  assert.ok(pdfSprayBlocks.card?.body);
  assert.match(
    uiRecommendation?.whyNow ?? "",
    new RegExp(pdfSprayBlocks.card.body.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );
  assert.equal(pdfSprayBlocks.card?.action, uiRecommendation?.inspectFirst);
});

test("UI report cards and PDF stay aligned on daily forecast aggregation", () => {
  const forecasts = [
    createHourlyForecast({
      validAt: "2026-04-03T06:00:00.000Z",
      airTemperatureC: 1,
      precipitationMm: 0.4,
      windSpeedKph: 15,
      precipitationProbabilityPct: 20,
    }),
    createHourlyForecast({
      validAt: "2026-04-03T18:00:00.000Z",
      airTemperatureC: 12,
      precipitationMm: 1.1,
      windSpeedKph: 22,
      precipitationProbabilityPct: 55,
    }),
    createHourlyForecast({
      validAt: "2026-04-04T12:00:00.000Z",
      airTemperatureC: 14,
      precipitationMm: 0,
      windSpeedKph: 18,
      precipitationProbabilityPct: 10,
    }),
  ];
  const readModel = createReadModel({
    cropType: "Canola",
    surfacePct: 58,
    signalSet: createSignalSet({
      soilTemp6cmCurrentC: 5.2,
      soilTemp6cmSustainedDays: 2,
      frostRiskMinTempC7d: 1.5,
      frostRiskNights7d: 1,
      frostProbabilityPct7d: 25,
    }),
    forecasts,
  });
  const reportProps = buildReportProps(readModel, FIELD.name, () => "just now");
  const forecastTable = findForecastTable(readModel);

  assert.equal(forecastTable?.kind, "table");
  assert.equal(reportProps.forecast.length, forecastTable?.rows.length);

  for (const [index, day] of reportProps.forecast.entries()) {
    const row = forecastTable?.rows[index];
    assert.ok(row);
    assert.equal(day.day, row.cells[0]);
    assert.equal(day.temp, `${Math.round(Number.parseFloat(row.cells[3] ?? "0"))}/${Math.round(Number.parseFloat(row.cells[2] ?? "0"))}`);
    assert.equal(
      day.precip,
      row.cells[6] !== "—" ? row.cells[6] : (row.cells[4] ?? "").replace(" ", ""),
    );
  }
});
