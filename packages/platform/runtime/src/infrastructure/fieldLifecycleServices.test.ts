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
import { commitFieldImportBatch } from "./fieldLifecycleServices";

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

  return {
    fieldImportBatches: {
      async getBatchById() {
        return batch;
      },
      async listCandidatesByBatch() {
        return [candidate];
      },
      async markCandidateCommitted(_workspaceId, _batchId, _candidateId, input) {
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
      async setLegalLandDescription(_workspaceId, _fieldId, legalLandDescription) {
        return {
          ...fieldDetail,
          legalLandDescription,
        };
      },
    } as unknown as ServerRepositories["fields"],
    fieldCropContexts: {
      async upsertContext(input) {
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
  } as unknown as ServerRepositories;
}

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

test("commitFieldImportBatch uses refresh onboarding after hydration replay", async () => {
  const recordedJobKeys: string[] = [];
  const repositories = createRepositories();
  const result = await commitFieldImportBatch(
    repositories,
    {
      jobDispatcher: createDispatcher(recordedJobKeys),
      hydrationReplay: {
        async replayFromImportCandidate() {
          return {
            action: "replayed",
            sourceFieldId: "source-field-1",
            sourceWorkspaceId: "source-workspace-1",
          };
        },
      },
    },
    {
      actorUserId: ACTOR_USER_ID,
      workspaceId: WORKSPACE_ID,
      batchId: BATCH_ID,
    },
  );

  assert.equal(result.candidates[0]?.action, "created");
  assert.deepEqual(recordedJobKeys, ["field.refresh-intake"]);
});

test("commitFieldImportBatch uses bootstrap onboarding when hydration replay skips", async () => {
  const recordedJobKeys: string[] = [];
  const repositories = createRepositories();
  const result = await commitFieldImportBatch(
    repositories,
    {
      jobDispatcher: createDispatcher(recordedJobKeys),
      hydrationReplay: {
        async replayFromImportCandidate() {
          return {
            action: "skipped",
            reason: "no-source-field",
          };
        },
      },
    },
    {
      actorUserId: ACTOR_USER_ID,
      workspaceId: WORKSPACE_ID,
      batchId: BATCH_ID,
    },
  );

  assert.equal(result.candidates[0]?.action, "created");
  assert.deepEqual(recordedJobKeys, ["field.bootstrap-initial"]);
});

test("commitFieldImportBatch retries hydration replay before falling back", async () => {
  const recordedJobKeys: string[] = [];
  const repositories = createRepositories();
  let attempts = 0;

  const result = await commitFieldImportBatch(
    repositories,
    {
      jobDispatcher: createDispatcher(recordedJobKeys),
      hydrationReplay: {
        async replayFromImportCandidate() {
          attempts += 1;
          if (attempts < 3) {
            throw new Error("transient replay failure");
          }

          return {
            action: "replayed",
            sourceFieldId: "source-field-1",
            sourceWorkspaceId: "source-workspace-1",
          };
        },
      },
    },
    {
      actorUserId: ACTOR_USER_ID,
      workspaceId: WORKSPACE_ID,
      batchId: BATCH_ID,
    },
  );

  assert.equal(result.candidates[0]?.action, "created");
  assert.equal(attempts, 3);
  assert.deepEqual(recordedJobKeys, ["field.refresh-intake"]);
});
