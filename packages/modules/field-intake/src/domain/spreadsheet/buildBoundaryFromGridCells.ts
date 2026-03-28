import type { FieldBoundary, GeoPoint } from "@fieldpulse/module-fields";
import { buildBoundaryLoops } from "./buildBoundaryLoops";
import { projectPlanarPoint } from "./quarterGrid";
import type { GridCell, PlanarPoint, PlanarRing } from "./types";

export function buildBoundaryFromGridCells(
  cells: readonly GridCell[],
  meridian: number,
): FieldBoundary {
  const loops = buildBoundaryLoops(cells);

  if (loops.length === 0) {
    throw new Error("[field-intake] no boundary loops could be built from spreadsheet rows");
  }

  const polygons = groupLoopsIntoPolygons(loops).map((polygon) => [
    projectRing(polygon.outer, meridian),
    ...polygon.holes.map((hole) => projectRing(hole, meridian)),
  ]);

  return {
    type: "MultiPolygon",
    coordinates: polygons,
  };
}

function groupLoopsIntoPolygons(loops: readonly PlanarRing[]) {
  const sorted = [...loops].sort(
    (left, right) => Math.abs(getSignedRingArea(right)) - Math.abs(getSignedRingArea(left)),
  );

  const polygons: Array<{
    outer: PlanarRing;
    holes: PlanarRing[];
  }> = [];

  for (const loop of sorted) {
    const containingPolygon = polygons.find((polygon) =>
      isPointInsideRing(loop[0], polygon.outer),
    );

    if (containingPolygon) {
      containingPolygon.holes.push(loop);
      continue;
    }

    polygons.push({
      outer: loop,
      holes: [],
    });
  }

  return polygons;
}

function projectRing(
  ring: readonly PlanarPoint[],
  meridian: number,
): readonly GeoPoint[] {
  return ring.map((point) => projectPlanarPoint(point, meridian));
}

function getSignedRingArea(ring: readonly PlanarPoint[]) {
  let area = 0;

  for (let index = 0; index < ring.length - 1; index += 1) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[index + 1];
    area += x1 * y2 - x2 * y1;
  }

  return area / 2;
}

function isPointInsideRing(
  point: PlanarPoint,
  ring: readonly PlanarPoint[],
) {
  let inside = false;

  for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current, current += 1) {
    const [xi, yi] = ring[current];
    const [xj, yj] = ring[previous];

    const intersects =
      yi > point[1] !== yj > point[1]
      && point[0]
        < ((xj - xi) * (point[1] - yi)) / ((yj - yi) || Number.EPSILON) + xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}
