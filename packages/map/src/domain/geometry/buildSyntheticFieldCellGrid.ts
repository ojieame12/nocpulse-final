import type {
  MapBoundingBox,
  MapGeoPoint,
  MapMultiPolygon,
} from "../render/FieldBoundaryPreviewRenderModel";
import { isPointInMultiPolygon } from "./isPointInMultiPolygon";
import { clipPolygonToRing, insetPolygon } from "./clipPolygon";

export type SyntheticFieldCell = {
  id: string;
  row: number;
  column: number;
  centroid: MapGeoPoint;
  polygon: MapGeoPoint[];
  normalizedX: number;
  normalizedY: number;
};

type BuildSyntheticFieldCellGridInput = {
  fieldId: string;
  boundary: MapMultiPolygon;
  bbox: MapBoundingBox;
  targetCellCount?: number;
  /** Fraction to inset each cell polygon (0.04 = 4 %, matches V1). */
  insetRatio?: number;
  /** Minimum coverage ratio to keep a clipped cell (0.15 = 15 %, matches V1). */
  minCoverageRatio?: number;
};

function closeRing(points: MapGeoPoint[]): MapGeoPoint[] {
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

/** Approximate polygon area using the shoelace formula (works in lat/lng). */
function polygonArea(ring: MapGeoPoint[]): number {
  let area = 0;
  const n = ring.length;
  for (let i = 0; i < n; i += 1) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % n];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
}

/** Compute centroid of a polygon ring. */
function polygonCentroid(ring: MapGeoPoint[]): MapGeoPoint {
  // Strip closing vertex if present.
  const pts =
    ring.length > 1 &&
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1]
      ? ring.slice(0, -1)
      : ring;

  let cx = 0;
  let cy = 0;
  for (const [x, y] of pts) {
    cx += x;
    cy += y;
  }
  return [cx / pts.length, cy / pts.length];
}

export function buildSyntheticFieldCellGrid({
  fieldId,
  boundary,
  bbox,
  targetCellCount = 36,
  insetRatio = 0.04,
  minCoverageRatio = 0.15,
}: BuildSyntheticFieldCellGridInput): SyntheticFieldCell[] {
  const [west, south, east, north] = bbox;
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
  const fullCellArea = cellWidth * cellHeight;
  const cells: SyntheticFieldCell[] = [];

  // Get the outer ring of the first polygon for clipping.
  // For MultiPolygon boundaries, use the first polygon's outer ring.
  const outerRing: readonly MapGeoPoint[] =
    boundary.coordinates.length > 0 && boundary.coordinates[0].length > 0
      ? boundary.coordinates[0][0]
      : [];

  for (let row = 0; row < rowCount; row += 1) {
    for (let column = 0; column < columnCount; column += 1) {
      const cellWest = west + column * cellWidth;
      const cellEast = cellWest + cellWidth;
      const cellSouth = south + row * cellHeight;
      const cellNorth = cellSouth + cellHeight;

      const rawRect: MapGeoPoint[] = [
        [cellWest, cellSouth],
        [cellEast, cellSouth],
        [cellEast, cellNorth],
        [cellWest, cellNorth],
      ];

      // ── Clip rectangle to field boundary ──
      let clipped: MapGeoPoint[];
      if (outerRing.length >= 3) {
        clipped = clipPolygonToRing(rawRect, outerRing);
        if (clipped.length < 3) continue;

        // Check coverage ratio — discard cells with too little overlap.
        const clippedArea = polygonArea(clipped);
        if (clippedArea / fullCellArea < minCoverageRatio) continue;
      } else {
        // No outer ring available — fall back to centroid check.
        const centroid: MapGeoPoint = [
          (cellWest + cellEast) / 2,
          (cellSouth + cellNorth) / 2,
        ];
        if (!isPointInMultiPolygon(centroid, boundary)) continue;
        clipped = rawRect;
      }

      // ── Inset polygon to create gaps between cells ──
      const inset = insetRatio > 0 ? insetPolygon(clipped, insetRatio) : clipped;
      const centroid = polygonCentroid(inset);

      cells.push({
        id: `${fieldId}:cell:${row}:${column}`,
        row,
        column,
        centroid,
        normalizedX: (column + 0.5) / columnCount,
        normalizedY: (row + 0.5) / rowCount,
        polygon: closeRing(inset),
      });
    }
  }

  return cells;
}
