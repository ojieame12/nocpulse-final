import {
  type FieldMoistureCellObservationSource,
  type MoistureCellFieldBoundary,
} from "@fieldpulse/module-moisture";
import { DEFAULT_IMAGERY_PROVIDER_ORDER } from "../domain/policies/providerOrder";
import type { ImageryProvider } from "../contracts/ImageryProvider";

type ImageryObservationPoint = readonly [longitude: number, latitude: number];

type CreateSyntheticImageryFieldMoistureCellObservationSourceOptions = {
  providers?: readonly ImageryProvider[];
  sourceKey?: string;
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function deriveBoundingBox(boundary: MoistureCellFieldBoundary) {
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

function isPointInRing(
  point: ImageryObservationPoint,
  ring: readonly ImageryObservationPoint[],
): boolean {
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

function isPointInBoundary(
  point: ImageryObservationPoint,
  boundary: MoistureCellFieldBoundary,
): boolean {
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

function closeRing(points: ImageryObservationPoint[]): ImageryObservationPoint[] {
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
      provider === "sentinel-2" ? 1.2 : provider === "planet" ? 1.6 : 0.9;

    return sum + weight * (index + 1);
  }, 0);
}

export function createSyntheticImageryFieldMoistureCellObservationSource({
  providers = DEFAULT_IMAGERY_PROVIDER_ORDER,
  sourceKey = "imagery-observation-synthetic-v1",
}: CreateSyntheticImageryFieldMoistureCellObservationSourceOptions = {}): FieldMoistureCellObservationSource {
  const providerBias = providerSignal(providers);

  return {
    observeCells(input) {
      const { west, south, east, north } = deriveBoundingBox(input.boundary);
      const width = east - west;
      const height = north - south;
      const aspectRatio = width / (height || Number.EPSILON);
      const columnCount = Math.max(
        4,
        Math.round(Math.sqrt(24 * Math.max(aspectRatio, 0.4))),
      );
      const rowCount = Math.max(4, Math.round(24 / columnCount));
      const cellWidth = width / columnCount;
      const cellHeight = height / rowCount;
      const cells = [];

      for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
        for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
          const cellWest = west + columnIndex * cellWidth;
          const cellEast = cellWest + cellWidth;
          const cellSouth = south + rowIndex * cellHeight;
          const cellNorth = cellSouth + cellHeight;
          const centroid: ImageryObservationPoint = [
            (cellWest + cellEast) / 2,
            (cellSouth + cellNorth) / 2,
          ];

          if (!isPointInBoundary(centroid, input.boundary)) {
            continue;
          }

          const normalizedX = (columnIndex + 0.5) / columnCount;
          const normalizedY = (rowIndex + 0.5) / rowCount;
          const spectralWave =
            Math.sin((normalizedX * 1.7 + normalizedY * 0.8 + providerBias) * Math.PI) * 7;
          const reliefBias =
            Math.cos((centroid[0] - centroid[1]) * 18) * 3.2;
          const rootZonePct = clamp(
            input.snapshot.rootZonePct + spectralWave + reliefBias,
            0,
            100,
          );
          const surfacePct = clamp(
            input.snapshot.surfacePct + spectralWave * 0.72 - reliefBias * 0.35,
            0,
            100,
          );

          cells.push({
            cellKey: `${input.fieldId}:imagery:${rowIndex}:${columnIndex}`,
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
            rootZonePct: Number(rootZonePct.toFixed(2)),
            surfacePct: Number(surfacePct.toFixed(2)),
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
