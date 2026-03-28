import type { LldComponents } from "./LldComponents";
import type { FieldDraft } from "./LldLookupResult";

export type SpreadsheetImportIssue = {
  rowNumber: number;
  fieldName?: string;
  legalLandDescription?: string;
  message: string;
};

export type SpreadsheetImportCandidate = {
  id: string;
  draft: FieldDraft;
  cropType?: string;
  rowCount: number;
  rowNumbers: readonly number[];
  legalLandDescriptions: readonly string[];
  splitIndex: number;
  splitCount: number;
  lldComponentsList: readonly LldComponents[];
};

export type SpreadsheetImportPreview = {
  fileName: string;
  sheetName: string;
  rowCount: number;
  validRowCount: number;
  fieldCount: number;
  issueCount: number;
  issues: readonly SpreadsheetImportIssue[];
  fields: readonly SpreadsheetImportCandidate[];
};

export type SpreadsheetImportRecord = Record<string, unknown>;

export type PreviewSpreadsheetImportRecordsInput = {
  records: readonly SpreadsheetImportRecord[];
  fileName?: string;
  sheetName?: string;
};

export type PreviewSpreadsheetImportFileInput = {
  buffer: ArrayBuffer;
  fileName: string;
};

export type SpreadsheetWorkbookReadResult = {
  fileName: string;
  sheetName: string;
  records: readonly SpreadsheetImportRecord[];
};

export type SpreadsheetWorkbookReader = {
  read(
    input: PreviewSpreadsheetImportFileInput,
  ): Promise<SpreadsheetWorkbookReadResult> | SpreadsheetWorkbookReadResult;
};
