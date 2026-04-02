import assert from "node:assert/strict";
import test from "node:test";
import type {
  FieldImportBatch,
  FieldImportCandidate,
} from "@fieldpulse/module-field-intake";
import type {
  FieldDetail,
  FieldOverview,
} from "@fieldpulse/module-fields";
import type {
  ServerJobDispatcher,
  ServerRepositories,
} from "../contracts/ServerRuntime";
import {
  commitFieldImportBatch,
  saveSpreadsheetImportPreview,
} from "./fieldLifecycleServices";

const WORKSPACE_ID = "workspace-1";
const ACTOR_USER_ID = "user-1";
const BATCH_ID = "batch-1";
const FIELD_ID = "field-1";
const CANDIDATE_ID = "candidate-1";

function createFieldDetail(): FieldDetail {
  return {
    id: FIELD_ID,
    workspaceId: WORKSPACE_ID,
    name: "Hope Creek North",
    areaHa: 64.7,
    legalLandDescription: null,
    boundary: {
      type: "MultiPolygon",
      coordinates: [[[
        [-109.6, 51.3],
        [-109.59, 51.3],
        [-109.59, 51.29],
        [-109.6, 51.29],
        [-109.6, 51.3],
      ]]],
    },
    labelPoint: [-109.595, 51.295],
    createdBy: ACTOR_USER_ID,
    createdAt: "2026-04-01T12:00:00.000Z",
    updatedAt: "2026-04-01T12:00:00.000Z",
  };
}

function createFieldOverview(): FieldOverview {
  return {
    id: FIELD_ID,
    workspaceId: WORKSPACE_ID,
    name: "Hope Creek North",
    areaHa: 64.7,
    legalLandDescription: null,
    latestMoisture: null,
  };
}

function createBatch(): FieldImportBatch {
  return {
    id: BATCH_ID,
    workspaceId: WORKSPACE_ID,
    sourceType: "spreadsheet",
    fileName: "hope-creek.csv",
    sheetName: "Sheet1",
    status: "previewed",
    rowCount: 1,
    validRowCount: 1,
    fieldCount: 1,
    issueCount: 0,
    issues: [],
    createdBy: ACTOR_USER_ID,
    committedBy: null,
    committedAt: null,
    createdAt: "2026-04-01T12:00:00.000Z",
    updatedAt: "2026-04-01T12:00:00.000Z",
  };
}

function createCandidate(): FieldImportCandidate {
  return {
    id: CANDIDATE_ID,
    batchId: BATCH_ID,
    workspaceId: WORKSPACE_ID,
    ordinal: 0,
    draft: {
      name: "Hope Creek North",
      areaHa: 64.7,
      boundary: createFieldDetail().boundary,
    },
    cropType: "canola",
    rowCount: 1,
    rowNumbers: [2],
    legalLandDescriptions: ["NW-36-042-28-W4"],
    splitIndex: 0,
    splitCount: 1,
    lldComponentsList: [],
    status: "pending",
    committedFieldId: null,
    commitAction: null,
    committedAt: null,
    createdAt: "2026-04-01T12:00:00.000Z",
    updatedAt: "2026-04-01T12:00:00.000Z",
  };
}

function createRepositories(): ServerRepositories {
  const fieldDetail = createFieldDetail();
  const fieldOverview = createFieldOverview();
  const batch = createBatch();
  const candidate = createCandidate();
  const latestSnapshot = {
    id: "snapshot-1",
    workspaceId: WORKSPACE_ID,
    fieldId: FIELD_ID,
    observedAt: "2026-04-01T12:00:00.000Z",
    sourceKey: "sentinel-1",
    rootZonePct: 31.4,
    surfacePct: 27.1,
    confidence: "high" as const,
    inputs: {
      derivationMode: "source-backed" as const,
      rasterMode: "provider" as const,
      signalBlend: "raster+weather" as const,
      confidenceScore: 0.82,
      confidenceReason: "fresh raster + weather pulse",
      soilDataset: "SoilGrids",
      baselineDataset: "ERA5-Land",
      weatherSourceKey: "open-meteo",
      rasterSourceKey: "sentinel-1",
      usedSar: true,
      usedWeather: true,
      usedWeatherSoilMoisture: true,
      rootZoneDepthCm: 60,
      availableWaterMm: 110,
      fieldCapacityPct: 36,
      wiltingPointPct: 16,
    },
    createdAt: "2026-04-01T12:00:00.000Z",
  };
  const latestWeatherObservation = {
    workspaceId: WORKSPACE_ID,
    fieldId: FIELD_ID,
    observedAt: "2026-04-01T12:00:00.000Z",
    sourceKey: "open-meteo",
    providerKey: "open-meteo",
    airTemperatureC: 8.4,
    precipitationMm: 0.2,
    windSpeedKph: 18,
    relativeHumidityPct: 61,
    soilMoisturePct: 29,
    evapotranspirationMm: 1.4,
    provenance: {},
    createdAt: "2026-04-01T12:00:00.000Z",
    updatedAt: "2026-04-01T12:00:00.000Z",
  };
  const latestRasterObservation = {
    id: "raster-1",
    workspaceId: WORKSPACE_ID,
    fieldId: FIELD_ID,
    observedAt: "2026-04-01T12:00:00.000Z",
    sourceKey: "sentinel-1",
    providerKey: "sentinel-1",
    artifactKey: "artifact-1",
    metadata: {},
    cells: [],
    createdAt: "2026-04-01T12:00:00.000Z",
    updatedAt: "2026-04-01T12:00:00.000Z",
  };
  const latestForecast = {
    workspaceId: WORKSPACE_ID,
    fieldId: FIELD_ID,
    forecastRunAt: "2026-04-01T12:00:00.000Z",
    validAt: "2026-04-01T13:00:00.000Z",
    sourceKey: "open-meteo",
    providerKey: "open-meteo",
    airTemperatureMinC: 2.1,
    airTemperatureMaxC: 10.5,
    precipitationMm: 0.4,
    precipitationProbabilityPct: 30,
    relativeHumidityPct: 55,
    windSpeedKph: 16,
    createdAt: "2026-04-01T12:00:00.000Z",
    updatedAt: "2026-04-01T12:00:00.000Z",
  };

  return {
    fieldImportBatches: {
      async getBatchById() {
        return batch;
      },
      async listCandidatesByBatch() {
        return [candidate];
      },
      async markCandidateCommitted(
        _workspaceId: string,
        _batchId: string,
        _candidateId: string,
        input: { fieldId: string; action: "created" | "reused" },
      ) {
        return {
          ...candidate,
          status: "committed",
          committedFieldId: input.fieldId,
          commitAction: input.action,
          committedAt: "2026-04-01T12:00:01.000Z",
        };
      },
      async markBatchCommitted() {
        return {
          ...batch,
          status: "committed",
          committedBy: ACTOR_USER_ID,
          committedAt: "2026-04-01T12:00:01.000Z",
        };
      },
      async createSpreadsheetImportBatch() {
        throw new Error("not used");
      },
      async findReusableSpreadsheetImportBatch() {
        return null;
      },
      async getLatestCommittedCandidateByField() {
        return null;
      },
    } as unknown as ServerRepositories["fieldImportBatches"],
    fields: {
      async create() {
        return fieldDetail;
      },
      async getById() {
        return fieldDetail;
      },
      async listOverviewByWorkspace() {
        return [] as readonly FieldOverview[];
      },
      async setLegalLandDescription(
        _workspaceId: string,
        _fieldId: string,
        legalLandDescription: string | null,
      ) {
        return {
          ...fieldDetail,
          legalLandDescription,
        };
      },
    } as unknown as ServerRepositories["fields"],
    fieldCropContexts: {
      async upsertContext(input: {
        workspaceId: string;
        fieldId: string;
        seasonYear: number;
        cropType: string;
        growthStage?: string | null;
        growthStageSource?: string | null;
        accumulatedGdd?: number;
        lastGddObservedOn?: string | null;
        lastWeatherSignalSetId?: string | null;
        lastStageUpdatedAt?: string | null;
        sourceKey: string;
        metadata?: Record<string, unknown>;
      }) {
        return {
          id: "crop-context-1",
          workspaceId: input.workspaceId,
          fieldId: input.fieldId,
          seasonYear: input.seasonYear,
          cropType: input.cropType,
          growthStage: input.growthStage ?? null,
          growthStageSource: input.growthStageSource ?? "imported",
          accumulatedGdd: input.accumulatedGdd ?? 0,
          lastGddObservedOn: input.lastGddObservedOn ?? null,
          lastWeatherSignalSetId: input.lastWeatherSignalSetId ?? null,
          lastStageUpdatedAt: input.lastStageUpdatedAt ?? null,
          sourceKey: input.sourceKey,
          metadata: input.metadata ?? {},
          createdAt: "2026-04-01T12:00:01.000Z",
          updatedAt: "2026-04-01T12:00:01.000Z",
        };
      },
    } as unknown as ServerRepositories["fieldCropContexts"],
    moistureSnapshots: {
      async getLatestByField() {
        return latestSnapshot;
      },
      async listRecentByField() {
        return [latestSnapshot];
      },
      async upsertSnapshot() {
        return latestSnapshot;
      },
    } as unknown as ServerRepositories["moistureSnapshots"],
    weatherObservations: {
      async getLatestByField() {
        return latestWeatherObservation;
      },
      async listLatestByWorkspace() {
        return [latestWeatherObservation];
      },
      async listRecentObservations() {
        return [latestWeatherObservation];
      },
      async listRecentByField() {
        return [latestWeatherObservation];
      },
      async upsertObservation() {
        return latestWeatherObservation;
      },
    } as unknown as ServerRepositories["weatherObservations"],
    weatherForecasts: {
      async listByField() {
        return [latestForecast];
      },
      async replaceForecastSet() {
        return [latestForecast];
      },
    } as unknown as ServerRepositories["weatherForecasts"],
    imageryRasterObservations: {
      async getLatestByField() {
        return latestRasterObservation;
      },
      async getLatestByFieldAndProvider() {
        return latestRasterObservation;
      },
      async replaceObservation() {
        return latestRasterObservation;
      },
    } as unknown as ServerRepositories["imageryRasterObservations"],
  } as unknown as ServerRepositories;
}

test("saveSpreadsheetImportPreview reuses a matching recent preview batch", async () => {
  const batch = createBatch();
  const candidate = createCandidate();
  let createCalls = 0;

  const repositories = createRepositories();
  repositories.fieldImportBatches.findReusableSpreadsheetImportBatch = async () => ({
    batch,
    candidates: [candidate],
  });
  repositories.fieldImportBatches.createSpreadsheetImportBatch = async () => {
    createCalls += 1;
    return { batch, candidates: [candidate] };
  };

  const result = await saveSpreadsheetImportPreview(repositories, {
    actorUserId: ACTOR_USER_ID,
    workspaceId: WORKSPACE_ID,
    preview: {
      fileName: batch.fileName,
      sheetName: batch.sheetName,
      rowCount: batch.rowCount,
      validRowCount: batch.validRowCount,
      fieldCount: batch.fieldCount,
      issueCount: batch.issueCount,
      issues: batch.issues,
      fields: [candidate],
    },
  });

  assert.equal(createCalls, 0);
  assert.equal(result.batch.id, batch.id);
});

test("saveSpreadsheetImportPreview creates a new batch when no reusable preview exists", async () => {
  const batch = createBatch();
  const candidate = createCandidate();
  let createCalls = 0;

  const repositories = createRepositories();
  repositories.fieldImportBatches.findReusableSpreadsheetImportBatch = async () => null;
  repositories.fieldImportBatches.createSpreadsheetImportBatch = async () => {
    createCalls += 1;
    return { batch, candidates: [candidate] };
  };

  await saveSpreadsheetImportPreview(repositories, {
    actorUserId: ACTOR_USER_ID,
    workspaceId: WORKSPACE_ID,
    preview: {
      fileName: batch.fileName,
      sheetName: batch.sheetName,
      rowCount: batch.rowCount,
      validRowCount: batch.validRowCount,
      fieldCount: batch.fieldCount,
      issueCount: batch.issueCount,
      issues: batch.issues,
      fields: [candidate],
    },
  });

  assert.equal(createCalls, 1);
});

function createDispatcher(recordedKeys: string[]): ServerJobDispatcher {
  return {
    async enqueue(input) {
      recordedKeys.push(input.key);
      return {
        key: input.key,
        payload: input.payload ?? null,
        result: {
          dispatchId: `${input.key}-dispatch`,
        },
      };
    },
  };
}

test("commitFieldImportBatch queues bootstrap onboarding with import context for created fields", async () => {
  const recordedJobKeys: string[] = [];
  const repositories = createRepositories();
  const result = await commitFieldImportBatch(
    repositories,
    {
      jobDispatcher: createDispatcher(recordedJobKeys),
    },
    {
      actorUserId: ACTOR_USER_ID,
      workspaceId: WORKSPACE_ID,
      batchId: BATCH_ID,
    },
  );

  assert.equal(result.candidates[0]?.action, "created");
  assert.deepEqual(recordedJobKeys, ["field.bootstrap-initial"]);
  assert.equal(result.fieldHydrationSummaries[0]?.status, "queued");
  assert.equal(result.fieldHydrationSummaries[0]?.hydrationMode, "cold-bootstrap");
  assert.equal(result.batchHydrationSummary.queuedFields, 1);
  assert.deepEqual(result.onboardingDispatches[0]?.receipts[0]?.payload, {
    workspaceId: WORKSPACE_ID,
    fieldId: FIELD_ID,
    fieldName: "Hope Creek North",
    requestedAt: result.onboardingDispatches[0]?.receipts[0]?.payload.requestedAt,
    providers: undefined,
    dryRun: undefined,
    cropType: "canola",
    legalLandDescriptions: ["NW-36-042-28-W4"],
    importBatchId: BATCH_ID,
    importCandidateId: CANDIDATE_ID,
    importSourceType: "spreadsheet",
    importAction: "created",
  });
});

test("commitFieldImportBatch uses refresh onboarding for reused fields", async () => {
  const recordedJobKeys: string[] = [];
  const repositories = createRepositories();
  repositories.fields.listOverviewByWorkspace = async () => [createFieldOverview()];
  const result = await commitFieldImportBatch(
    repositories,
    {
      jobDispatcher: createDispatcher(recordedJobKeys),
    },
    {
      actorUserId: ACTOR_USER_ID,
      workspaceId: WORKSPACE_ID,
      batchId: BATCH_ID,
    },
  );

  assert.equal(result.candidates[0]?.action, "reused");
  assert.deepEqual(recordedJobKeys, ["field.refresh-intake"]);
  assert.equal(result.fieldHydrationSummaries[0]?.status, "queued");
  assert.equal(result.fieldHydrationSummaries[0]?.moistureConfidence, null);
  assert.equal(result.fieldHydrationSummaries[0]?.hydrationMode, "refresh");
});

test("commitFieldImportBatch returns existing hydration summary when no dispatcher is configured for reused fields", async () => {
  const repositories = createRepositories();
  repositories.fields.listOverviewByWorkspace = async () => [createFieldOverview()];

  const result = await commitFieldImportBatch(
    repositories,
    {},
    {
      actorUserId: ACTOR_USER_ID,
      workspaceId: WORKSPACE_ID,
      batchId: BATCH_ID,
    },
  );

  assert.equal(result.candidates[0]?.action, "reused");
  assert.equal(result.fieldHydrationSummaries[0]?.status, "completed");
  assert.equal(result.fieldHydrationSummaries[0]?.hydrationMode, "existing");
  assert.equal(result.fieldHydrationSummaries[0]?.moistureConfidence?.level, "high");
});
