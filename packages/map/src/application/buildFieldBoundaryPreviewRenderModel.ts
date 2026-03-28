import type {
  FieldBoundaryPreviewRenderModel,
  MapBoundingBox,
  MapGeoPoint,
  MapMultiPolygon,
} from "../domain/render/FieldBoundaryPreviewRenderModel";
import { resolveFieldBoundaryPreviewPresentation } from "./resolveFieldBoundaryPreviewPresentation";
import type { MapLightingPresetId } from "../contracts/lighting";
import type { MapTerrainContextMode } from "../contracts/terrain";
import { buildFieldMoistureSurfaceRenderModel } from "./buildFieldMoistureSurfaceRenderModel";
import { buildFieldAgronomicSurfaceRenderModel } from "./buildFieldAgronomicSurfaceRenderModel";
import type { FieldAgronomicSurfaceMetricKey } from "../domain/render/FieldAgronomicSurfaceRenderModel";

type ReadonlyMapGeoPoint = readonly [longitude: number, latitude: number];
type ReadonlyMapMultiPolygon = {
  type: "MultiPolygon";
  coordinates: readonly (readonly (readonly ReadonlyMapGeoPoint[])[])[];
};

type BuildFieldBoundaryPreviewRenderModelInput = {
  fieldId: string;
  fieldName: string;
  boundary: ReadonlyMapMultiPolygon;
  labelPoint: ReadonlyMapGeoPoint;
  viewportPaddingPx?: number;
  lightingPresetId?: MapLightingPresetId;
  terrainContextMode?: MapTerrainContextMode;
  /** Generic agronomic surface — supports NDVI, NDRE, NDMI, moisture. Takes precedence over moistureSurface. */
  agronomicSurface?: {
    metricKey: FieldAgronomicSurfaceMetricKey;
    baseValuePct: number;
    confidence: "low" | "medium" | "high";
    sourceLabel: string;
    cells?: readonly {
      cellKey: string;
      centroid: readonly [number, number];
      boundary: {
        type: "Polygon";
        coordinates: readonly (readonly (readonly [number, number])[])[];
      };
      measurements: Readonly<Record<string, number>>;
      sourceKey: string;
    }[];
  } | null;
  /** Legacy moisture-specific surface input. Used when agronomicSurface is not provided. */
  moistureSurface?: {
    rootZonePct: number;
    surfacePct: number;
    confidence: "low" | "medium" | "high";
    sourceLabel: string;
    cells?: readonly {
      cellKey: string;
      centroid: readonly [number, number];
      boundary: {
        type: "Polygon";
        coordinates: readonly (readonly (readonly [number, number])[])[];
      };
      rootZonePct: number;
      surfacePct: number;
      sourceKey: string;
    }[];
  } | null;
};

function deriveBoundingBox(boundary: MapMultiPolygon): MapBoundingBox {
  let west = Number.POSITIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;

  for (const polygon of boundary.coordinates) {
    for (const ring of polygon) {
      for (const [longitude, latitude] of ring) {
        west = Math.min(west, longitude);
        south = Math.min(south, latitude);
        east = Math.max(east, longitude);
        north = Math.max(north, latitude);
      }
    }
  }

  if (
    !Number.isFinite(west) ||
    !Number.isFinite(south) ||
    !Number.isFinite(east) ||
    !Number.isFinite(north)
  ) {
    throw new Error("[map] field boundary render model requires finite coordinates");
  }

  if (west === east) {
    west -= 0.0005;
    east += 0.0005;
  }

  if (south === north) {
    south -= 0.0005;
    north += 0.0005;
  }

  return [west, south, east, north];
}

function cloneBoundary(boundary: BuildFieldBoundaryPreviewRenderModelInput["boundary"]): MapMultiPolygon {
  return {
    type: "MultiPolygon",
    coordinates: boundary.coordinates.map((polygon) =>
      polygon.map((ring) =>
        ring.map(([longitude, latitude]) => [longitude, latitude]),
      ),
    ),
  };
}

export function buildFieldBoundaryPreviewRenderModel({
  fieldId,
  fieldName,
  boundary,
  labelPoint,
  viewportPaddingPx = 48,
  lightingPresetId,
  terrainContextMode,
  agronomicSurface: agronomicSurfaceInput = null,
  moistureSurface = null,
}: BuildFieldBoundaryPreviewRenderModelInput): FieldBoundaryPreviewRenderModel {
  const normalizedBoundary = cloneBoundary(boundary);
  const bbox = deriveBoundingBox(normalizedBoundary);
  const presentation = resolveFieldBoundaryPreviewPresentation({
    lightingPresetId,
    terrainContextMode,
    viewportPaddingPx,
  });

  const boundaryFeature = {
    type: "Feature" as const,
    properties: {
      fieldId,
      fieldName,
    },
    geometry: normalizedBoundary,
  };

  // Resolve the agronomic surface: generic metric input takes precedence,
  // falling back to the legacy moisture-specific input.
  const resolvedAgronomicSurface = agronomicSurfaceInput
    ? buildFieldAgronomicSurfaceRenderModel({
        fieldId,
        boundaryFeature,
        bbox,
        metricKey: agronomicSurfaceInput.metricKey,
        baseValuePct: agronomicSurfaceInput.baseValuePct,
        confidence: agronomicSurfaceInput.confidence,
        sourceLabel: agronomicSurfaceInput.sourceLabel,
        persistedCells: agronomicSurfaceInput.cells?.map((cell) => ({
          cellKey: cell.cellKey,
          centroid: [cell.centroid[0], cell.centroid[1]],
          boundary: {
            type: "Polygon",
            coordinates: cell.boundary.coordinates.map((ring) =>
              ring.map(([longitude, latitude]) => [longitude, latitude]),
            ),
          },
          measurements: cell.measurements,
          sourceKey: cell.sourceKey,
        })),
      })
    : moistureSurface
      ? buildFieldMoistureSurfaceRenderModel({
          fieldId,
          boundaryFeature,
          bbox,
          rootZonePct: moistureSurface.rootZonePct,
          surfacePct: moistureSurface.surfacePct,
          confidence: moistureSurface.confidence,
          sourceLabel: moistureSurface.sourceLabel,
          persistedCells: moistureSurface.cells?.map((cell) => ({
            cellKey: cell.cellKey,
            centroid: [cell.centroid[0], cell.centroid[1]],
            boundary: {
              type: "Polygon",
              coordinates: cell.boundary.coordinates.map((ring) =>
                ring.map(([longitude, latitude]) => [longitude, latitude]),
              ),
            },
            rootZonePct: cell.rootZonePct,
            surfacePct: cell.surfacePct,
            sourceKey: cell.sourceKey,
          })),
        })
      : null;

  return {
    fieldId,
    fieldName,
    bbox,
    labelPoint: [labelPoint[0], labelPoint[1]],
    agronomicSurface: resolvedAgronomicSurface,
    focusedZoneId: null,
    presentation,
    boundaryFeature,
  };
}
