import * as XLSX from "xlsx";
import type {
  PreviewSpreadsheetImportFileInput,
  SpreadsheetWorkbookReader,
} from "../contracts/SpreadsheetImport";

export function createDefaultSpreadsheetWorkbookReader(): SpreadsheetWorkbookReader {
  return {
    read(input: PreviewSpreadsheetImportFileInput) {
      const workbook = XLSX.read(input.buffer, {
        type: "array",
        raw: false,
      });
      const sheetName = workbook.SheetNames[0];

      if (!sheetName) {
        throw new Error("[field-intake] spreadsheet does not contain any sheets");
      }

      const sheet = workbook.Sheets[sheetName];
      const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
        raw: false,
      });

      if (records.length === 0) {
        throw new Error("[field-intake] spreadsheet is empty");
      }

      return {
        fileName: input.fileName,
        sheetName,
        records,
      };
    },
  };
}
