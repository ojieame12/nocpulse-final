import assert from "node:assert/strict";
import test from "node:test";
import type { FieldCropContext } from "@fieldpulse/module-field-crop-context";
import type { FieldDetail } from "@fieldpulse/module-fields";
import type { FieldMoistureSnapshot } from "@fieldpulse/module-moisture";
import type {
  FieldWeatherDerivedSignalSet,
  FieldWeatherProfile,
} from "@fieldpulse/module-weather";
import type { FieldReportReadModel } from "../contracts/FieldReportReadModel";
import { buildFieldReportPdfRenderInput } from "./buildFieldReportPdfRenderInput";

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

function createSignalSet(input: {
  soilTemp6cmCurrentC: number | null;
  soilTemp6cmSustainedDays: number | null;
  frostRiskMinTempC7d: number | null;
  frostRiskNights7d: number | null;
  frostProbabilityPct7d: number | null;
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
    sprayWindowCount24h: 0,
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

test("buildFieldReportPdfRenderInput surfaces a too-early canola verdict from the shared engine", () => {
  const card = findSeedingCard(
    createReadModel({
      cropType: "Canola",
      surfacePct: 58,
      signalSet: createSignalSet({
        soilTemp6cmCurrentC: 4.8,
        soilTemp6cmSustainedDays: 0,
        frostRiskMinTempC7d: 2.5,
        frostRiskNights7d: 0,
        frostProbabilityPct7d: 8,
      }),
    }),
  );

  assert.equal(card?.kind, "severity-card");
  assert.equal(card?.title, "Too Early to Seed — Canola");
  assert.match(card?.body ?? "", /needs sustained ≥7°C/i);
});

test("buildFieldReportPdfRenderInput surfaces a ready wheat verdict from the shared engine", () => {
  const card = findSeedingCard(
    createReadModel({
      cropType: "Wheat",
      surfacePct: 62,
      signalSet: createSignalSet({
        soilTemp6cmCurrentC: 6.2,
        soilTemp6cmSustainedDays: 3,
        frostRiskMinTempC7d: 2.8,
        frostRiskNights7d: 0,
        frostProbabilityPct7d: 5,
      }),
    }),
  );

  assert.equal(card?.kind, "severity-card");
  assert.equal(card?.title, "Seeding Window Open — Wheat");
  assert.match(card?.body ?? "", /field access is workable/i);
});

test("buildFieldReportPdfRenderInput aggregates hourly forecast periods into daily forecast rows", () => {
  const renderInput = buildFieldReportPdfRenderInput({
    artifactKey: "test-artifact",
    readModel: createReadModel({
      cropType: "Canola",
      surfacePct: 58,
      signalSet: createSignalSet({
        soilTemp6cmCurrentC: 5.2,
        soilTemp6cmSustainedDays: 2,
        frostRiskMinTempC7d: 1.5,
        frostRiskNights7d: 1,
        frostProbabilityPct7d: 25,
      }),
      forecasts: [
        {
          id: "forecast-1",
          workspaceId: "workspace-1",
          fieldId: "field-1",
          forecastRunAt: "2026-04-03T12:00:00.000Z",
          validAt: "2026-04-03T06:00:00.000Z",
          sourceKey: "open-meteo:hourly-v1",
          providerKey: "open-meteo",
          airTemperatureMinC: 1,
          airTemperatureMaxC: 8,
          precipitationMm: 0.4,
          windSpeedKph: 15,
          relativeHumidityPct: null,
          evapotranspirationMm: null,
          precipitationProbabilityPct: 20,
          createdAt: "2026-04-03T12:00:00.000Z",
          updatedAt: "2026-04-03T12:00:00.000Z",
        },
        {
          id: "forecast-2",
          workspaceId: "workspace-1",
          fieldId: "field-1",
          forecastRunAt: "2026-04-03T12:00:00.000Z",
          validAt: "2026-04-03T18:00:00.000Z",
          sourceKey: "open-meteo:hourly-v1",
          providerKey: "open-meteo",
          airTemperatureMinC: 4,
          airTemperatureMaxC: 12,
          precipitationMm: 1.1,
          windSpeedKph: 22,
          relativeHumidityPct: null,
          evapotranspirationMm: null,
          precipitationProbabilityPct: 55,
          createdAt: "2026-04-03T12:00:00.000Z",
          updatedAt: "2026-04-03T12:00:00.000Z",
        },
        {
          id: "forecast-3",
          workspaceId: "workspace-1",
          fieldId: "field-1",
          forecastRunAt: "2026-04-03T12:00:00.000Z",
          validAt: "2026-04-04T12:00:00.000Z",
          sourceKey: "open-meteo:hourly-v1",
          providerKey: "open-meteo",
          airTemperatureMinC: 6,
          airTemperatureMaxC: 14,
          precipitationMm: 0,
          windSpeedKph: 18,
          relativeHumidityPct: null,
          evapotranspirationMm: null,
          precipitationProbabilityPct: 10,
          createdAt: "2026-04-03T12:00:00.000Z",
          updatedAt: "2026-04-03T12:00:00.000Z",
        },
      ],
    }),
  });

  const forecastHeader = renderInput.blocks.find(
    (block) => block.kind === "section-header" && block.label === "Forecast",
  );
  const forecastTable = renderInput.blocks.find(
    (block) => block.kind === "table" && block.columns[0]?.label === "Day",
  );

  assert.equal(forecastHeader?.kind, "section-header");
  assert.equal(forecastHeader?.meta, "Next 2 days");
  assert.equal(forecastTable?.kind, "table");
  assert.equal(forecastTable?.rows.length, 2);
  assert.deepEqual(forecastTable?.rows[0]?.cells.slice(1), [
    "Chance of showers",
    "1.0°",
    "12.0°",
    "1.5 mm",
    "22.0 km/h",
    "55%",
  ]);
});
