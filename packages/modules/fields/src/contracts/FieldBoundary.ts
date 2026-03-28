export type GeoPoint = readonly [longitude: number, latitude: number];

export type FieldBoundary = {
  type: "MultiPolygon";
  coordinates: readonly (readonly (readonly GeoPoint[])[])[];
};
