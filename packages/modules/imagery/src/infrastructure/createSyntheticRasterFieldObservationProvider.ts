import type { RasterFieldGridObservation, RasterMultiPolygon, RasterPoint } from "@fieldpulse/raster";
import { DEFAULT_IMAGERY_PROVIDER_ORDER } from "../domain/policies/providerOrder";
import type { ImageryProvider } from "../contracts/ImageryProvider";
import type {
  FieldRasterObservationInput,
  FieldRasterObservationProvider,
} from "./FieldRasterObservationProvider";

type CreateSyntheticRasterFieldObservationProviderOptions = {
  providers?: readonly ImageryProvider[];
  sourceKey?: string;
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function deriveBoundingBox(boundary: RasterMultiPolygon) {
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

  return { west, south, east, north };
}

function isPointInRing(point: RasterPoint, ring: readonly RasterPoint[]): boolean {
  const [longitude, latitude] = point;
  let inside = false;

  for (
    let current = 0, previous = ring.length - 1;
    current < ring.length;
    previous = current, current += 1
  ) {
    const [currentLongitude, currentLatitude] = ring[current];
    const [previousLongitude, previousLatitude] = ring[previous];

    const intersects =
      currentLatitude > latitude !== previousLatitude > latitude &&
      longitude <
        ((previousLongitude - currentLongitude) * (latitude - currentLatitude)) /
          ((previousLatitude - currentLatitude) || Number.EPSILON) +
          currentLongitude;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function isPointInBoundary(point: RasterPoint, boundary: RasterMultiPolygon): boolean {
  return boundary.coordinates.some((polygon) => {
    if (polygon.length === 0 || !isPointInRing(point, polygon[0])) {
      return false;
    }

    for (let index = 1; index < polygon.length; index += 1) {
      if (isPointInRing(point, polygon[index])) {
        return false;
      }
    }

    return true;
  });
}

function closeRing(points: RasterPoint[]): RasterPoint[] {
  if (points.length === 0) {
    return points;
  }

  const [firstLongitude, firstLatitude] = points[0];
  const [lastLongitude, lastLatitude] = points[points.length - 1];

  if (firstLongitude === lastLongitude && firstLatitude === lastLatitude) {
    return points;
  }

  return [...points, [firstLongitude, firstLatitude]];
}

function providerSignal(providers: readonly ImageryProvider[]): number {
  return providers.reduce((sum, provider, index) => {
    const weight =
      provider === "sentinel-2" ? 1.15 : provider === "planet" ? 1.55 : 0.95;

    return sum + weight * (index + 1);
  }, 0);
}

function resolveGridDimensions(targetCellCount: number, aspectRatio: number) {
  const columnCount = Math.max(
    4,
    Math.round(Math.sqrt(targetCellCount * Math.max(aspectRatio, 0.45))),
  );
  const rowCount = Math.max(4, Math.round(targetCellCount / columnCount));

  return { rowCount, columnCount };
}

function buildMeasurementValue(
  normalizedX: number,
  normalizedY: number,
  providerBias: number,
  observedAtBias: number,
) {
  const ndmi =
    0.52 +
    Math.sin((normalizedX * 1.8 + normalizedY * 0.65 + providerBias * 0.15) * Math.PI) *
      0.22;
  const ndvi =
    0.57 +
    Math.cos((normalizedX * 0.9 + normalizedY * 1.35 + observedAtBias) * Math.PI) *
      0.18;
  const thermal =
    0.5 +
    Math.sin((normalizedX * 0.55 - normalizedY * 1.25 + observedAtBias * 1.4) * Math.PI) *
      0.16;
  const shadow =
    0.48 +
    Math.cos((normalizedX * 1.5 - normalizedY * 0.75 + providerBias * 0.22) * Math.PI) *
      0.12;

  return {
    ndmi: clamp(Number(ndmi.toFixed(4)), 0, 1),
    ndvi: clamp(Number(ndvi.toFixed(4)), 0, 1),
    thermal: clamp(Number(thermal.toFixed(4)), 0, 1),
    shadow: clamp(Number(shadow.toFixed(4)), 0, 1),
  };
}

export function createSyntheticRasterFieldObservationProvider({
  providers = DEFAULT_IMAGERY_PROVIDER_ORDER,
  sourceKey = "synthetic-raster-grid-v1",
}: CreateSyntheticRasterFieldObservationProviderOptions = {}): FieldRasterObservationProvider {
  const providerBias = providerSignal(providers);

  return {
    observeFieldRaster(input: FieldRasterObservationInput): RasterFieldGridObservation | null {
      const { west, south, east, north } = deriveBoundingBox(input.boundary);
      const width = east - west;
      const height = north - south;

      if (width <= 0 || height <= 0) {
        return null;
      }

      const aspectRatio = width / (height || Number.EPSILON);
      const observedAtBias = new Date(input.observedAt).getUTCDate() / 31;
      const { rowCount, columnCount } = resolveGridDimensions(
        input.targetCellCount ?? 24,
        aspectRatio,
      );
      const cellWidth = width / columnCount;
      const cellHeight = height / rowCount;
      const cells = [];

      for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
        for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
          const cellWest = west + columnIndex * cellWidth;
          const cellEast = cellWest + cellWidth;
          const cellSouth = south + rowIndex * cellHeight;
          const cellNorth = cellSouth + cellHeight;
          const centroid: RasterPoint = [
            (cellWest + cellEast) / 2,
            (cellSouth + cellNorth) / 2,
          ];

          if (!isPointInBoundary(centroid, input.boundary)) {
            continue;
          }

          const normalizedX = (columnIndex + 0.5) / columnCount;
          const normalizedY = (rowIndex + 0.5) / rowCount;

          cells.push({
            cellKey: `${input.fieldId}:raster:${rowIndex}:${columnIndex}`,
            rowIndex,
            columnIndex,
            centroid,
            boundary: {
              type: "Polygon" as const,
              coordinates: [
                closeRing([
                  [cellWest, cellSouth],
                  [cellEast, cellSouth],
                  [cellEast, cellNorth],
                  [cellWest, cellNorth],
                ]),
              ],
            },
            measurements: buildMeasurementValue(
              normalizedX,
              normalizedY,
              providerBias,
              observedAtBias,
            ),
          });
        }
      }

      return {
        sourceKey: `${sourceKey}:${providers.join("+")}`,
        cells,
      };
    },
  };
}
