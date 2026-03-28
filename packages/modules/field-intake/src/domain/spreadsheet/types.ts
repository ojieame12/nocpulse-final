import type { LldComponents } from "../../contracts/LldComponents";

export type ParsedSpreadsheetImportRow = {
  rowNumber: number;
  fieldName: string;
  cropType?: string;
  legalLandDescription: string;
  lldComponents: LldComponents;
};

export type GridCell = {
  x: number;
  y: number;
  meridian: number;
};

export type PlanarPoint = readonly [x: number, y: number];

export type PlanarRing = readonly PlanarPoint[];
