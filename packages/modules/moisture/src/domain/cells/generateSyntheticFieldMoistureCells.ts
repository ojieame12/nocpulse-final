import type { EntityId } from "@fieldpulse/platform-db";
import type {
  MoistureCellPoint,
  MoistureCellPolygon,
} from "../../contracts/FieldMoistureCellSnapshot";

type MoistureFieldBoundary = {
  type: "MultiPolygon";
  coordinates: readonly (readonly (readonly MoistureCellPoint[])[])[];
};

type GeneratedFieldMoistureCell = {
  cellKey: string;
  rowIndex: number;
  columnIndex: number;
  centroid: MoistureCellPoint;
  boundary: MoistureCellPolygon;
  rootZonePct: number;
  surfacePct: number;
};

type GenerateSyntheticFieldMoistureCellsInput = {
  fieldId: EntityId;
  boundary: MoistureFieldBoundary;
  rootZonePct: number;
  surfacePct: number;
  targetCellCount?: number;
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function deriveBoundingBox(boundary: MoistureFieldBoundary) {
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
  point: MoistureCellPoint,
  ring: readonly MoistureCellPoint[],
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
  point: MoistureCellPoint,
  boundary: MoistureFieldBoundary,
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

function closeRing(points: MoistureCellPoint[]): MoistureCellPoint[] {
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

function resolveCellMoistureValue(
  baseValuePct: number,
  centroid: MoistureCellPoint,
  normalizedX: number,
  normalizedY: number,
): number {
  const wave = Math.sin((normalizedX + normalizedY) * Math.PI * 2.2) * 6;
  const drift = (normalizedX - 0.5) * 18 + (0.5 - normalizedY) * 10;
  const geographicBias = Math.sin((centroid[0] + centroid[1]) * 25) * 2.5;

  return clamp(baseValuePct + wave + drift + geographicBias, 0, 100);
}

export function generateSyntheticFieldMoistureCells({
  fieldId,
  boundary,
  rootZonePct,
  surfacePct,
  targetCellCount = 18,
}: GenerateSyntheticFieldMoistureCellsInput): readonly GeneratedFieldMoistureCell[] {
  const { west, south, east, north } = deriveBoundingBox(boundary);
  const width = east - west;
  const height = north - south;
  const aspectRatio = width / (height || Number.EPSILON);
  const columnCount = Math.max(
    3,
    Math.round(Math.sqrt(targetCellCount * Math.max(aspectRatio, 0.4))),
  );
  const rowCount = Math.max(3, Math.round(targetCellCount / columnCount));
  const cellWidth = width / columnCount;
  const cellHeight = height / rowCount;
  const cells: GeneratedFieldMoistureCell[] = [];

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      const cellWest = west + columnIndex * cellWidth;
      const cellEast = cellWest + cellWidth;
      const cellSouth = south + rowIndex * cellHeight;
      const cellNorth = cellSouth + cellHeight;
      const centroid: MoistureCellPoint = [
        (cellWest + cellEast) / 2,
        (cellSouth + cellNorth) / 2,
      ];

      if (!isPointInBoundary(centroid, boundary)) {
        continue;
      }

      const normalizedX = (columnIndex + 0.5) / columnCount;
      const normalizedY = (rowIndex + 0.5) / rowCount;

      cells.push({
        cellKey: `${fieldId}:cell:${rowIndex}:${columnIndex}`,
        rowIndex,
        columnIndex,
        centroid,
        boundary: {
          type: "Polygon",
          coordinates: [
            closeRing([
              [cellWest, cellSouth],
              [cellEast, cellSouth],
              [cellEast, cellNorth],
              [cellWest, cellNorth],
            ]),
          ],
        },
        rootZonePct: resolveCellMoistureValue(
          rootZonePct,
          centroid,
          normalizedX,
          normalizedY,
        ),
        surfacePct: resolveCellMoistureValue(
          surfacePct,
          centroid,
          normalizedY,
          normalizedX,
        ),
      });
    }
  }

  return cells;
}
