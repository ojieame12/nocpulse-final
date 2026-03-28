import type { MapLightingPreset, MapLightingPresetId } from "./lighting";
import type { MapTerrainContext, MapTerrainContextMode } from "./terrain";
import type { MapRgbaColor } from "../domain/render/FieldBoundaryPreviewRenderModel";

export type FieldBoundaryPreviewPalette = {
  fillColor: MapRgbaColor;
  lineColor: MapRgbaColor;
  labelFillColor: MapRgbaColor;
  labelLineColor: MapRgbaColor;
};

export type FieldBoundaryPreviewCamera = {
  bearing: number;
  pitch: number;
  maxZoom: number;
  paddingPx: number;
};

export type FieldBoundaryPreviewPresentation = {
  lightingPresetId: MapLightingPresetId;
  lightingPreset: MapLightingPreset;
  terrainContextMode: MapTerrainContextMode;
  terrainContext: MapTerrainContext;
  camera: FieldBoundaryPreviewCamera;
  palette: FieldBoundaryPreviewPalette;
};
