import assert from "node:assert/strict";
import test from "node:test";

import { isReusableSpreadsheetImportBatch } from "./reuseSpreadsheetImportBatch.shared";

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

function createPreview() {
  return {
    fileName: "import.xlsx",
    sheetName: "Sheet1",
    rowCount: 2,
    validRowCount: 1,
    fieldCount: 1,
    issueCount: 1,
    issues: [{ rowNumber: 3, message: "Missing crop type." }],
    fields: [
      {
        id: "preview-1",
        draft: {
          name: "North Quarter",
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
            quarter: "NW" as const,
            section: 1,
            township: 10,
            range: 1,
            meridian: 4 as const,
          },
        ],
      },
    ],
  } as const;
}

function createBatch() {
  return {
    id: "batch-1",
    workspaceId: "workspace-1",
    sourceType: "spreadsheet" as const,
    fileName: "import.xlsx",
    sheetName: "Sheet1",
    status: "previewed" as const,
    rowCount: 2,
    validRowCount: 1,
    fieldCount: 1,
    issueCount: 1,
    issues: [{ rowNumber: 3, message: "Missing crop type." }],
    createdBy: "user-1",
    committedBy: null,
    committedAt: null,
    createdAt: "2026-04-02T00:00:00.000Z",
    updatedAt: "2026-04-02T00:00:00.000Z",
  };
}

function createCandidate() {
  return {
    id: "candidate-1",
    batchId: "batch-1",
    workspaceId: "workspace-1",
    ordinal: 1,
    draft: {
      name: "North Quarter",
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
        quarter: "NW" as const,
        section: 1,
        township: 10,
        range: 1,
        meridian: 4 as const,
      },
    ],
    status: "pending" as const,
    committedFieldId: null,
    commitAction: null,
    committedAt: null,
    createdAt: "2026-04-02T00:00:00.000Z",
    updatedAt: "2026-04-02T00:00:00.000Z",
  };
}

test("isReusableSpreadsheetImportBatch matches identical preview batches", () => {
  assert.equal(
    isReusableSpreadsheetImportBatch({
      preview: createPreview(),
      batch: createBatch(),
      candidates: [createCandidate()],
    }),
    true,
  );
});

test("isReusableSpreadsheetImportBatch rejects different candidate payloads", () => {
  const mismatchedCandidate = {
    ...createCandidate(),
    rowNumbers: [4],
  };

  assert.equal(
    isReusableSpreadsheetImportBatch({
      preview: createPreview(),
      batch: createBatch(),
      candidates: [mismatchedCandidate],
    }),
    false,
  );
});

test("isReusableSpreadsheetImportBatch ignores json object key order", () => {
  const persistedCandidate = {
    ...createCandidate(),
    draft: {
      name: "North Quarter",
      areaHa: 64.8,
      boundary: {
        coordinates: boundary.coordinates,
        type: boundary.type,
      },
    },
  };

  assert.equal(
    isReusableSpreadsheetImportBatch({
      preview: createPreview(),
      batch: createBatch(),
      candidates: [persistedCandidate],
    }),
    true,
  );
});

test("isReusableSpreadsheetImportBatch tolerates persisted geometry rounding", () => {
  const persistedCandidate = {
    ...createCandidate(),
    draft: {
      name: "North Quarter",
      areaHa: 64.8,
      boundary: {
        type: "MultiPolygon" as const,
        coordinates: [[[
          [-110, 50],
          [-109.9, 50],
          [-109.9, 49.9],
          [-110, 49.9],
          [-110, 50],
        ]]],
      },
    },
  };

  assert.equal(
    isReusableSpreadsheetImportBatch({
      preview: createPreview(),
      batch: createBatch(),
      candidates: [persistedCandidate],
    }),
    true,
  );
});
