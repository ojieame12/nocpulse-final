import { normalizeLldCode } from "../lld/normalizeLldCode";
import { getSpreadsheetColumnValue } from "./headerAliases";
import {
  normalizeImportedCropType,
  normalizeSpreadsheetString,
  parseSpreadsheetMeridian,
  parseSpreadsheetPositiveInteger,
  parseSpreadsheetQuarter,
} from "./normalizeSpreadsheetValues";
import type { ParsedSpreadsheetImportRow } from "./types";

export function parseSpreadsheetRecord(
  record: Record<string, unknown>,
  rowNumber: number,
): ParsedSpreadsheetImportRow {
  const fieldName = normalizeSpreadsheetString(
    getSpreadsheetColumnValue(record, "fieldName"),
  );

  if (!fieldName) {
    throw new Error("Field name is required.");
  }

  const quarter = parseSpreadsheetQuarter(
    getSpreadsheetColumnValue(record, "quarter"),
  );
  const section = parseSpreadsheetPositiveInteger(
    getSpreadsheetColumnValue(record, "section"),
    "Section",
  );
  const township = parseSpreadsheetPositiveInteger(
    getSpreadsheetColumnValue(record, "township"),
    "Township",
  );
  const range = parseSpreadsheetPositiveInteger(
    getSpreadsheetColumnValue(record, "range"),
    "Range",
  );
  const meridian = parseSpreadsheetMeridian(
    getSpreadsheetColumnValue(record, "meridian"),
  );

  const legalLandDescription = `${quarter}-${String(section).padStart(2, "0")}-${String(
    township,
  ).padStart(3, "0")}-${String(range).padStart(2, "0")}-W${meridian}`;
  const resolved = normalizeLldCode(legalLandDescription);

  return {
    rowNumber,
    fieldName,
    cropType: normalizeImportedCropType(
      getSpreadsheetColumnValue(record, "cropType"),
    ),
    legalLandDescription: resolved.normalized,
    lldComponents: resolved.components,
  };
}
