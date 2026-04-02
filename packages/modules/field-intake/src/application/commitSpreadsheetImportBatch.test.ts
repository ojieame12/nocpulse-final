import test from "node:test";
import assert from "node:assert/strict";
import { commitSpreadsheetImportBatch } from "./commitSpreadsheetImportBatch";

const boundary = {
  type: "MultiPolygon",
  coordinates: [[[
    [-110, 50],
    [-109.9, 50],
    [-109.9, 49.9],
    [-110, 49.9],
    [-110, 50],
  ]]],
} as const;

test("commitSpreadsheetImportBatch loads workspace fields once per batch", async () => {
  let listOverviewCalls = 0;
  let createCalls = 0;
  let getByIdCalls = 0;
  let markCommittedCalls = 0;
  let setLegalLandDescriptionCalls = 0;

  const result = await commitSpreadsheetImportBatch({
    repository: {
      async createSpreadsheetImportBatch() {
        throw new Error("not used in this test");
      },
      async getBatchById() {
        return {
          id: "batch-1",
          workspaceId: "workspace-1",
          sourceType: "spreadsheet",
          fileName: "import.xlsx",
          sheetName: "Sheet1",
          status: "previewed",
          rowCount: 2,
          validRowCount: 2,
          fieldCount: 2,
          issueCount: 0,
          issues: [],
          createdBy: "user-1",
          committedBy: null,
          committedAt: null,
          createdAt: "2026-04-02T00:00:00.000Z",
          updatedAt: "2026-04-02T00:00:00.000Z",
        };
      },
      async listCandidatesByBatch() {
        return [
          {
            id: "candidate-1",
            batchId: "batch-1",
            workspaceId: "workspace-1",
            ordinal: 1,
            draft: {
              name: "Alpha",
              areaHa: 64.75,
              boundary,
            },
            cropType: "Canola",
            rowCount: 1,
            rowNumbers: [2],
            legalLandDescriptions: ["NW-01-010-01-W4"],
            splitIndex: 1,
            splitCount: 1,
            lldComponentsList: [
              {
                quarter: "NW",
                section: 1,
                township: 10,
                range: 1,
                meridian: 4,
              },
            ],
            status: "pending",
            committedFieldId: null,
            commitAction: null,
            committedAt: null,
            createdAt: "2026-04-02T00:00:00.000Z",
            updatedAt: "2026-04-02T00:00:00.000Z",
          },
          {
            id: "candidate-2",
            batchId: "batch-1",
            workspaceId: "workspace-1",
            ordinal: 2,
            draft: {
              name: "Bravo",
              areaHa: 64.75,
              boundary,
            },
            cropType: "Peas",
            rowCount: 1,
            rowNumbers: [3],
            legalLandDescriptions: ["SW-02-010-01-W4"],
            splitIndex: 1,
            splitCount: 1,
            lldComponentsList: [
              {
                quarter: "SW",
                section: 2,
                township: 10,
                range: 1,
                meridian: 4,
              },
            ],
            status: "pending",
            committedFieldId: null,
            commitAction: null,
            committedAt: null,
            createdAt: "2026-04-02T00:00:00.000Z",
            updatedAt: "2026-04-02T00:00:00.000Z",
          },
        ];
      },
      async getLatestCommittedCandidateByField() {
        return null;
      },
      async markCandidateCommitted(_workspaceId, _batchId, candidateId, input) {
        markCommittedCalls += 1;

        return {
          id: candidateId,
          batchId: "batch-1",
          workspaceId: "workspace-1",
          ordinal: candidateId === "candidate-1" ? 1 : 2,
          draft: {
            name: candidateId === "candidate-1" ? "Alpha" : "Bravo",
            areaHa: 64.75,
            boundary,
          },
          cropType: candidateId === "candidate-1" ? "Canola" : "Peas",
          rowCount: 1,
          rowNumbers: [candidateId === "candidate-1" ? 2 : 3],
          legalLandDescriptions: [
            candidateId === "candidate-1"
              ? "NW-01-010-01-W4"
              : "SW-02-010-01-W4",
          ],
          splitIndex: 1,
          splitCount: 1,
          lldComponentsList: [],
          status: "committed",
          committedFieldId: input.fieldId,
          commitAction: input.action,
          committedAt: "2026-04-02T00:01:00.000Z",
          createdAt: "2026-04-02T00:00:00.000Z",
          updatedAt: "2026-04-02T00:01:00.000Z",
        };
      },
      async markBatchCommitted() {
        return {
          id: "batch-1",
          workspaceId: "workspace-1",
          sourceType: "spreadsheet",
          fileName: "import.xlsx",
          sheetName: "Sheet1",
          status: "committed",
          rowCount: 2,
          validRowCount: 2,
          fieldCount: 2,
          issueCount: 0,
          issues: [],
          createdBy: "user-1",
          committedBy: "user-1",
          committedAt: "2026-04-02T00:01:00.000Z",
          createdAt: "2026-04-02T00:00:00.000Z",
          updatedAt: "2026-04-02T00:01:00.000Z",
        };
      },
    },
    fieldRepository: {
      async create(field) {
        createCalls += 1;

        return {
          id: "field-alpha",
          workspaceId: field.workspaceId,
          name: field.name,
          areaHa: field.areaHa,
          legalLandDescription: field.legalLandDescription ?? null,
        };
      },
      async getById(workspaceId, fieldId) {
        getByIdCalls += 1;

        return {
          id: fieldId,
          workspaceId,
          name: "Bravo",
          areaHa: 64.75,
          legalLandDescription: "SW-02-010-01-W4",
        };
      },
      async listOverviewByWorkspace() {
        listOverviewCalls += 1;

        return [
          {
            id: "field-bravo",
            workspaceId: "workspace-1",
            name: "Bravo",
            areaHa: 64.75,
            legalLandDescription: "SW-02-010-01-W4",
            latestMoisture: null,
          },
        ];
      },
      async setLegalLandDescription(workspaceId, fieldId, legalLandDescription) {
        setLegalLandDescriptionCalls += 1;

        return {
          id: fieldId,
          workspaceId,
          name: fieldId === "field-alpha" ? "Alpha" : "Bravo",
          areaHa: 64.75,
          legalLandDescription,
        };
      },
    },
    actorUserId: "user-1",
    workspaceId: "workspace-1",
    batchId: "batch-1",
  });

  assert.equal(listOverviewCalls, 1);
  assert.equal(createCalls, 1);
  assert.equal(getByIdCalls, 0);
  assert.equal(markCommittedCalls, 2);
  assert.equal(setLegalLandDescriptionCalls, 0);
  assert.equal(result.candidates.length, 2);
  assert.equal(result.candidates[0]?.action, "created");
  assert.equal(result.candidates[1]?.action, "reused");
  assert.equal(result.batch.status, "committed");
});

test("commitSpreadsheetImportBatch updates legal land description only when it changes", async () => {
  let setLegalLandDescriptionCalls = 0;

  const result = await commitSpreadsheetImportBatch({
    repository: {
      async createSpreadsheetImportBatch() {
        throw new Error("not used in this test");
      },
      async getBatchById() {
        return {
          id: "batch-1",
          workspaceId: "workspace-1",
          sourceType: "spreadsheet",
          fileName: "import.xlsx",
          sheetName: "Sheet1",
          status: "previewed",
          rowCount: 1,
          validRowCount: 1,
          fieldCount: 1,
          issueCount: 0,
          issues: [],
          createdBy: "user-1",
          committedBy: null,
          committedAt: null,
          createdAt: "2026-04-02T00:00:00.000Z",
          updatedAt: "2026-04-02T00:00:00.000Z",
        };
      },
      async listCandidatesByBatch() {
        return [
          {
            id: "candidate-1",
            batchId: "batch-1",
            workspaceId: "workspace-1",
            ordinal: 1,
            draft: {
              name: "Bravo",
              areaHa: 64.75,
              boundary,
            },
            cropType: "Canola",
            rowCount: 1,
            rowNumbers: [2],
            legalLandDescriptions: ["SW-02-010-01-W4"],
            splitIndex: 1,
            splitCount: 1,
            lldComponentsList: [
              {
                quarter: "SW",
                section: 2,
                township: 10,
                range: 1,
                meridian: 4,
              },
            ],
            status: "pending",
            committedFieldId: null,
            commitAction: null,
            committedAt: null,
            createdAt: "2026-04-02T00:00:00.000Z",
            updatedAt: "2026-04-02T00:00:00.000Z",
          },
        ];
      },
      async getLatestCommittedCandidateByField() {
        return null;
      },
      async markCandidateCommitted(_workspaceId, _batchId, candidateId, input) {
        return {
          id: candidateId,
          batchId: "batch-1",
          workspaceId: "workspace-1",
          ordinal: 1,
          draft: {
            name: "Bravo",
            areaHa: 64.75,
            boundary,
          },
          cropType: "Canola",
          rowCount: 1,
          rowNumbers: [2],
          legalLandDescriptions: ["SW-02-010-01-W4"],
          splitIndex: 1,
          splitCount: 1,
          lldComponentsList: [],
          status: "committed",
          committedFieldId: input.fieldId,
          commitAction: input.action,
          committedAt: "2026-04-02T00:01:00.000Z",
          createdAt: "2026-04-02T00:00:00.000Z",
          updatedAt: "2026-04-02T00:01:00.000Z",
        };
      },
      async markBatchCommitted() {
        return {
          id: "batch-1",
          workspaceId: "workspace-1",
          sourceType: "spreadsheet",
          fileName: "import.xlsx",
          sheetName: "Sheet1",
          status: "committed",
          rowCount: 1,
          validRowCount: 1,
          fieldCount: 1,
          issueCount: 0,
          issues: [],
          createdBy: "user-1",
          committedBy: "user-1",
          committedAt: "2026-04-02T00:01:00.000Z",
          createdAt: "2026-04-02T00:00:00.000Z",
          updatedAt: "2026-04-02T00:01:00.000Z",
        };
      },
    },
    fieldRepository: {
      async create() {
        throw new Error("not used");
      },
      async getById() {
        throw new Error("not used");
      },
      async listOverviewByWorkspace() {
        return [
          {
            id: "field-bravo",
            workspaceId: "workspace-1",
            name: "Bravo",
            areaHa: 64.75,
            legalLandDescription: null,
            latestMoisture: null,
          },
        ];
      },
      async setLegalLandDescription(workspaceId, fieldId, legalLandDescription) {
        setLegalLandDescriptionCalls += 1;

        return {
          id: fieldId,
          workspaceId,
          name: "Bravo",
          areaHa: 64.75,
          legalLandDescription,
        };
      },
    },
    actorUserId: "user-1",
    workspaceId: "workspace-1",
    batchId: "batch-1",
  });

  assert.equal(setLegalLandDescriptionCalls, 1);
  assert.equal(
    result.candidates[0]?.field.legalLandDescription,
    "SW-02-010-01-W4",
  );
});

test("commitSpreadsheetImportBatch replays a committed batch without creating or remarking fields", async () => {
  let createCalls = 0;
  let markCommittedCalls = 0;
  let markBatchCommittedCalls = 0;
  let getByIdCalls = 0;

  const result = await commitSpreadsheetImportBatch({
    repository: {
      async createSpreadsheetImportBatch() {
        throw new Error("not used in this test");
      },
      async getBatchById() {
        return {
          id: "batch-1",
          workspaceId: "workspace-1",
          sourceType: "spreadsheet",
          fileName: "import.xlsx",
          sheetName: "Sheet1",
          status: "committed",
          rowCount: 1,
          validRowCount: 1,
          fieldCount: 1,
          issueCount: 0,
          issues: [],
          createdBy: "user-1",
          committedBy: "user-1",
          committedAt: "2026-04-02T00:01:00.000Z",
          createdAt: "2026-04-02T00:00:00.000Z",
          updatedAt: "2026-04-02T00:01:00.000Z",
        };
      },
      async listCandidatesByBatch() {
        return [
          {
            id: "candidate-1",
            batchId: "batch-1",
            workspaceId: "workspace-1",
            ordinal: 1,
            draft: {
              name: "Alpha",
              areaHa: 64.75,
              boundary,
            },
            cropType: "Canola",
            rowCount: 1,
            rowNumbers: [2],
            legalLandDescriptions: ["NW-01-010-01-W4"],
            splitIndex: 1,
            splitCount: 1,
            lldComponentsList: [
              {
                quarter: "NW",
                section: 1,
                township: 10,
                range: 1,
                meridian: 4,
              },
            ],
            status: "committed",
            committedFieldId: "field-alpha",
            commitAction: "created",
            committedAt: "2026-04-02T00:01:00.000Z",
            createdAt: "2026-04-02T00:00:00.000Z",
            updatedAt: "2026-04-02T00:01:00.000Z",
          },
        ];
      },
      async getLatestCommittedCandidateByField() {
        return null;
      },
      async markCandidateCommitted() {
        markCommittedCalls += 1;
        throw new Error("not used");
      },
      async markBatchCommitted() {
        markBatchCommittedCalls += 1;
        throw new Error("not used");
      },
    },
    fieldRepository: {
      async create() {
        createCalls += 1;
        throw new Error("not used");
      },
      async getById(workspaceId, fieldId) {
        getByIdCalls += 1;
        return {
          id: fieldId,
          workspaceId,
          name: "Alpha",
          areaHa: 64.75,
          legalLandDescription: "NW-01-010-01-W4",
        };
      },
      async listOverviewByWorkspace() {
        return [];
      },
      async setLegalLandDescription() {
        throw new Error("not used");
      },
    },
    actorUserId: "user-1",
    workspaceId: "workspace-1",
    batchId: "batch-1",
  });

  assert.equal(createCalls, 0);
  assert.equal(markCommittedCalls, 0);
  assert.equal(markBatchCommittedCalls, 0);
  assert.equal(getByIdCalls, 1);
  assert.equal(result.batch.status, "committed");
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0]?.field.id, "field-alpha");
  assert.equal(result.candidates[0]?.action, "created");
});
