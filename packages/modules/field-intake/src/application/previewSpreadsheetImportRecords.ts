import type {
  PreviewSpreadsheetImportRecordsInput,
  SpreadsheetImportCandidate,
  SpreadsheetImportIssue,
  SpreadsheetImportPreview,
} from "../contracts/SpreadsheetImport";
import { deriveFieldGeometry } from "../domain/geometry/deriveFieldGeometry";
import { buildBoundaryFromGridCells } from "../domain/spreadsheet/buildBoundaryFromGridCells";
import {
  buildConnectedRowGroups,
  sortSpreadsheetRows,
} from "../domain/spreadsheet/buildConnectedRowGroups";
import { parseSpreadsheetRecord } from "../domain/spreadsheet/parseSpreadsheetRecord";
import { getQuarterGridCell } from "../domain/spreadsheet/quarterGrid";
import type { ParsedSpreadsheetImportRow } from "../domain/spreadsheet/types";

export function previewSpreadsheetImportRecords(
  input: PreviewSpreadsheetImportRecordsInput,
): SpreadsheetImportPreview {
  const issues: SpreadsheetImportIssue[] = [];
  const parsedRows: ParsedSpreadsheetImportRow[] = [];

  input.records.forEach((record, index) => {
    const rowNumber = index + 2;

    try {
      parsedRows.push(parseSpreadsheetRecord(record, rowNumber));
    } catch (error) {
      issues.push({
        rowNumber,
        fieldName:
          typeof record.fieldName === "string" ? record.fieldName : undefined,
        message:
          error instanceof Error
            ? error.message
            : "This row could not be parsed.",
      });
    }
  });

  const fields = buildSpreadsheetImportCandidates(parsedRows);

  return {
    fileName: input.fileName ?? "Spreadsheet import",
    sheetName: input.sheetName ?? "Sheet1",
    rowCount: input.records.length,
    validRowCount: parsedRows.length,
    fieldCount: fields.length,
    issueCount: issues.length,
    issues,
    fields,
  };
}

function buildSpreadsheetImportCandidates(
  rows: readonly ParsedSpreadsheetImportRow[],
) {
  const grouped = new Map<string, ParsedSpreadsheetImportRow[]>();

  for (const row of rows) {
    const key = getRowGroupKey(row);
    const existing = grouped.get(key);

    if (existing) {
      existing.push(row);
    } else {
      grouped.set(key, [row]);
    }
  }

  const fields: SpreadsheetImportCandidate[] = [];

  for (const groupRows of grouped.values()) {
    const orderedRows = sortSpreadsheetRows(groupRows);
    const components = buildConnectedRowGroups(orderedRows);
    const splitCount = components.length;

    components.forEach((componentRows, index) => {
      if (componentRows.length === 0) {
        return;
      }

      const primaryRow = componentRows[0];
      const meridian = primaryRow.lldComponents.meridian;
      const cells = componentRows.map((row) => getQuarterGridCell(row.lldComponents));
      const boundary = buildBoundaryFromGridCells(cells, meridian);
      const geometry = deriveFieldGeometry(boundary);
      const legalLandDescriptions = componentRows
        .map((row) => row.legalLandDescription)
        .sort();

      fields.push({
        id: `${getRowGroupKey(primaryRow)}::${index}`,
        draft: {
          name:
            splitCount > 1
              ? `${primaryRow.fieldName} (${index + 1})`
              : primaryRow.fieldName,
          areaHa: geometry.areaHa,
          boundary,
        },
        cropType: primaryRow.cropType,
        rowCount: componentRows.length,
        rowNumbers: componentRows.map((row) => row.rowNumber),
        legalLandDescriptions,
        splitIndex: index + 1,
        splitCount,
        lldComponentsList: componentRows.map((row) => row.lldComponents),
      });
    });
  }

  return fields;
}

function getRowGroupKey(row: ParsedSpreadsheetImportRow) {
  return `${row.fieldName.toLowerCase()}::${(row.cropType ?? "").toLowerCase()}`;
}
