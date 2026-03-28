import {
  DEFAULT_MAP_LIGHTING_PRESET,
  MAP_LIGHTING_PRESETS,
  type MapLightingPreset,
  type MapLightingPresetId,
} from "../contracts/lighting";
import {
  MAP_TERRAIN_CONTEXTS,
  type MapTerrainContext,
  type MapTerrainContextMode,
} from "../contracts/terrain";
import type { FieldBoundaryPreviewPresentation } from "../contracts/presentation";
import type { MapRgbaColor } from "../domain/render/FieldBoundaryPreviewRenderModel";

type ResolveFieldBoundaryPreviewPresentationInput = {
  lightingPresetId?: MapLightingPresetId;
  terrainContextMode?: MapTerrainContextMode;
  viewportPaddingPx: number;
};

function getLightingPreset(
  presetId: MapLightingPresetId | undefined,
): MapLightingPreset {
  if (!presetId) {
    return DEFAULT_MAP_LIGHTING_PRESET;
  }

  return (
    MAP_LIGHTING_PRESETS.find((preset) => preset.id === presetId) ??
    DEFAULT_MAP_LIGHTING_PRESET
  );
}

function getTerrainContext(
  mode: MapTerrainContextMode | undefined,
  lightingPreset: MapLightingPreset,
): MapTerrainContext {
  if (mode) {
    return MAP_TERRAIN_CONTEXTS[mode];
  }

  return lightingPreset.id === "flat-day" || lightingPreset.id === "report-export"
    ? MAP_TERRAIN_CONTEXTS.flat
    : MAP_TERRAIN_CONTEXTS["contextual-relief"];
}

function withAlpha(
  [red, green, blue]: readonly [number, number, number],
  alpha: number,
): MapRgbaColor {
  return [red, green, blue, alpha];
}

function normalizeBearing(bearing: number): number {
  return ((bearing % 360) + 360) % 360;
}

export function resolveFieldBoundaryPreviewPresentation({
  lightingPresetId,
  terrainContextMode,
  viewportPaddingPx,
}: ResolveFieldBoundaryPreviewPresentationInput): FieldBoundaryPreviewPresentation {
  const lightingPreset = getLightingPreset(lightingPresetId);
  const terrainContext = getTerrainContext(terrainContextMode, lightingPreset);
  const directionalBearing = normalizeBearing(lightingPreset.cameraBearing);
  // Both modes need enough pitch to see extrusion side-walls.
  // contextual-relief: steeper (48°) for dramatic shading
  // flat: moderate (38°) so walls are clearly visible
  const pitch = terrainContext.mode === "contextual-relief" ? 48 : 38;
  const lineColor =
    terrainContext.mode === "contextual-relief"
      ? withAlpha([25, 55, 42], 200)
      : withAlpha([37, 60, 52], 180);
  const fillAlpha = terrainContext.mode === "contextual-relief" ? 42 : 32;
  const fillColor = withAlpha([42, 120, 85], fillAlpha);

  return {
    lightingPresetId: lightingPreset.id,
    lightingPreset,
    terrainContextMode: terrainContext.mode,
    terrainContext,
    camera: {
      bearing: directionalBearing,
      pitch,
      maxZoom: terrainContext.mode === "contextual-relief" ? 15 : 16,
      paddingPx: viewportPaddingPx,
    },
    palette: {
      fillColor,
      lineColor,
      labelFillColor: withAlpha([255, 255, 255], 224),
      labelLineColor: lineColor,
    },
  };
}
