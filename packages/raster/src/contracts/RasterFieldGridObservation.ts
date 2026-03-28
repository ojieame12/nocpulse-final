export type RasterPoint = readonly [longitude: number, latitude: number];

export type RasterPolygon = {
  type: "Polygon";
  coordinates: readonly (readonly RasterPoint[])[];
};

export type RasterMultiPolygon = {
  type: "MultiPolygon";
  coordinates: readonly (readonly (readonly RasterPoint[])[])[];
};

export type RasterFieldGridCell = {
  cellKey: string;
  rowIndex: number;
  columnIndex: number;
  centroid: RasterPoint;
  boundary: RasterPolygon;
  measurements: Readonly<Record<string, number>>;
};

export type RasterFieldGridObservation = {
  sourceKey: string;
  cells: readonly RasterFieldGridCell[];
};
