import type {
  PreviewSpreadsheetImportFileInput,
  SpreadsheetImportPreview,
  SpreadsheetWorkbookReader,
} from "../contracts/SpreadsheetImport";
import { previewSpreadsheetImportRecords } from "./previewSpreadsheetImportRecords";

export async function previewSpreadsheetImportFile(input: {
  reader: SpreadsheetWorkbookReader;
  file: PreviewSpreadsheetImportFileInput;
}): Promise<SpreadsheetImportPreview> {
  const workbook = await input.reader.read(input.file);

  return previewSpreadsheetImportRecords({
    records: workbook.records,
    fileName: workbook.fileName,
    sheetName: workbook.sheetName,
  });
}
