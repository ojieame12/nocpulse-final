import type { FieldImportBatch, FieldImportCandidate } from "../contracts/FieldImportBatch";
import type {
  SpreadsheetImportCandidate,
  SpreadsheetImportIssue,
  SpreadsheetImportPreview,
} from "../contracts/SpreadsheetImport";

function stableJson(value: unknown) {
  return JSON.stringify(value);
}

function normalizeIssue(issue: SpreadsheetImportIssue) {
  return {
    rowNumber: issue.rowNumber,
    fieldName: issue.fieldName ?? null,
    legalLandDescription: issue.legalLandDescription ?? null,
    message: issue.message,
  };
}

function normalizePreviewCandidate(candidate: SpreadsheetImportCandidate) {
  return {
    name: candidate.draft.name,
    areaHa: candidate.draft.areaHa,
    boundary: candidate.draft.boundary,
    cropType: candidate.cropType ?? null,
    rowCount: candidate.rowCount,
    rowNumbers: [...candidate.rowNumbers],
    legalLandDescriptions: [...candidate.legalLandDescriptions],
    splitIndex: candidate.splitIndex,
    splitCount: candidate.splitCount,
    lldComponentsList: candidate.lldComponentsList.map((entry) => ({
      quarter: entry.quarter,
      section: entry.section,
      township: entry.township,
      range: entry.range,
      meridian: entry.meridian,
    })),
  };
}

function normalizePersistedCandidate(candidate: FieldImportCandidate) {
  return {
    name: candidate.draft.name,
    areaHa: candidate.draft.areaHa,
    boundary: candidate.draft.boundary,
    cropType: candidate.cropType ?? null,
    rowCount: candidate.rowCount,
    rowNumbers: [...candidate.rowNumbers],
    legalLandDescriptions: [...candidate.legalLandDescriptions],
    splitIndex: candidate.splitIndex,
    splitCount: candidate.splitCount,
    lldComponentsList: candidate.lldComponentsList.map((entry) => ({
      quarter: entry.quarter,
      section: entry.section,
      township: entry.township,
      range: entry.range,
      meridian: entry.meridian,
    })),
  };
}

export function isReusableSpreadsheetImportBatch(input: {
  preview: SpreadsheetImportPreview;
  batch: FieldImportBatch;
  candidates: readonly FieldImportCandidate[];
}) {
  if (input.batch.status !== "previewed") {
    return false;
  }

  if (input.batch.fileName !== input.preview.fileName) {
    return false;
  }

  if (input.batch.sheetName !== input.preview.sheetName) {
    return false;
  }

  if (input.batch.rowCount !== input.preview.rowCount) {
    return false;
  }

  if (input.batch.validRowCount !== input.preview.validRowCount) {
    return false;
  }

  if (input.batch.fieldCount !== input.preview.fieldCount) {
    return false;
  }

  if (input.batch.issueCount !== input.preview.issueCount) {
    return false;
  }

  if (input.candidates.length !== input.preview.fields.length) {
    return false;
  }

  const normalizedPreviewIssues = stableJson(
    input.preview.issues.map(normalizeIssue),
  );
  const normalizedBatchIssues = stableJson(
    input.batch.issues.map(normalizeIssue),
  );

  if (normalizedPreviewIssues !== normalizedBatchIssues) {
    return false;
  }

  const normalizedPreviewCandidates = stableJson(
    input.preview.fields.map(normalizePreviewCandidate),
  );
  const normalizedPersistedCandidates = stableJson(
    input.candidates.map(normalizePersistedCandidate),
  );

  return normalizedPreviewCandidates === normalizedPersistedCandidates;
}
