import type { FieldBoundaryPreviewPresentation } from "../../contracts/presentation";
import type { FieldAgronomicSurfaceRenderModel } from "./FieldAgronomicSurfaceRenderModel";

export type MapGeoPoint = [longitude: number, latitude: number];
export type MapRgbColor = [red: number, green: number, blue: number];
export type MapRgbaColor = [red: number, green: number, blue: number, alpha: number];

export type MapMultiPolygon = {
  type: "MultiPolygon";
  coordinates: MapGeoPoint[][][];
};

export type MapBoundingBox = readonly [
  west: number,
  south: number,
  east: number,
  north: number,
];

export type FieldBoundaryFeature = {
  type: "Feature";
  properties: {
    fieldId: string;
    fieldName: string;
  };
  geometry: MapMultiPolygon;
};

export type FieldBoundaryPreviewRenderModel = {
  fieldId: string;
  fieldName: string;
  bbox: MapBoundingBox;
  labelPoint: MapGeoPoint;
  boundaryFeature: FieldBoundaryFeature;
  agronomicSurface: FieldAgronomicSurfaceRenderModel | null;
  focusedZoneId?: string | null;
  presentation: FieldBoundaryPreviewPresentation;
};
