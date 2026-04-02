import test from "node:test";
import assert from "node:assert/strict";
import { previewSpreadsheetImportRecords } from "./previewSpreadsheetImportRecords";

test("previewSpreadsheetImportRecords accepts spreadsheets with combined LLD columns", () => {
  const result = previewSpreadsheetImportRecords({
    records: [
      {
        LLD: "SW-24-15-17-W2",
        "Crops to be grown ": "Lentils",
      },
      {
        LLD: "NW-2-15-16-W2",
        "Crops to be grown ": "Flax",
      },
    ],
    fileName: "combined-lld.xlsx",
    sheetName: "Sheet1",
  });

  assert.equal(result.rowCount, 2);
  assert.equal(result.validRowCount, 2);
  assert.equal(result.issueCount, 0);
  assert.equal(result.fieldCount, 2);
  assert.equal(result.fields[0]?.draft.name, "SW-24-015-17-W2");
  assert.equal(result.fields[0]?.cropType, "Lentils");
  assert.deepEqual(result.fields[0]?.legalLandDescriptions, [
    "SW-24-015-17-W2",
  ]);
  assert.equal(result.fields[1]?.draft.name, "NW-02-015-16-W2");
  assert.equal(result.fields[1]?.cropType, "Flax");
});

test("previewSpreadsheetImportRecords supports grouped field names and multi-quarter rows", () => {
  const result = previewSpreadsheetImportRecords({
    records: [
      {
        "Name of field": "Dean Peterson (Peas)",
        "LSD/ Quarter": "SW + SE",
        Sections: 6,
        Townships: 11,
        Ranges: 16,
        Meridians: "W3",
      },
      {
        "Name of field": "",
        "LSD/ Quarter": "NE + SE",
        Sections: 18,
        Townships: 11,
        Ranges: 17,
        Meridians: "W3",
      },
      {
        "Name of field": "",
        "LSD/ Quarter": "SE",
        Sections: 15,
        Townships: 11,
        Ranges: 17,
        Meridians: "W3",
      },
      {
        "Name of field": "Dean Peterson (Durum)",
        "LSD/ Quarter": "",
        Sections: 2,
        Townships: 11,
        Ranges: 17,
        Meridians: "W3",
      },
    ],
  });

  assert.equal(result.rowCount, 4);
  assert.equal(result.validRowCount, 4);
  assert.equal(result.issueCount, 0);
  assert.equal(result.fieldCount, 4);

  const bundledQuarterField = result.fields.find(
    (field) =>
      field.legalLandDescriptions.includes("SE-06-011-16-W3") &&
      field.legalLandDescriptions.includes("SW-06-011-16-W3"),
  );

  assert.ok(bundledQuarterField);
  assert.equal(bundledQuarterField.cropType, "Peas");
  assert.equal(bundledQuarterField.rowCount, 1);
  assert.deepEqual(bundledQuarterField.rowNumbers, [2]);

  const sectionField = result.fields.find((field) =>
    field.legalLandDescriptions.includes("02-011-17-W3"),
  );

  assert.ok(sectionField);
  assert.equal(sectionField.cropType, "Durum");
  assert.equal(sectionField.rowCount, 1);
  assert.deepEqual(sectionField.rowNumbers, [5]);
  assert.equal(sectionField.lldComponentsList.length, 4);
});
