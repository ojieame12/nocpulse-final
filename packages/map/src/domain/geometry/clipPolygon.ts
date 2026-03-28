import type { MapGeoPoint } from "../render/FieldBoundaryPreviewRenderModel";

/**
 * Sutherland-Hodgman polygon clipping.
 *
 * Clips `subject` against each edge of the `clip` polygon's outer ring.
 * Both polygons are [lng, lat] coordinate arrays.
 *
 * This algorithm is exact when the clip polygon is convex, and produces
 * acceptable results for near-convex farm boundaries.  Returns an empty
 * array if the subject is fully outside the clip region.
 */
export function clipPolygonToRing(
  subject: MapGeoPoint[],
  clipRing: readonly MapGeoPoint[],
): MapGeoPoint[] {
  let output = [...subject];

  // Ensure the clip ring is a closed loop.
  const rawRing =
    clipRing.length > 0 &&
    clipRing[0][0] === clipRing[clipRing.length - 1][0] &&
    clipRing[0][1] === clipRing[clipRing.length - 1][1]
      ? clipRing.slice(0, -1)
      : [...clipRing];
  const ring = normalizeRingOrientation(rawRing);

  for (let i = 0; i < ring.length; i += 1) {
    if (output.length === 0) return [];

    const edgeStart = ring[i];
    const edgeEnd = ring[(i + 1) % ring.length];
    const input = output;
    output = [];

    for (let j = 0; j < input.length; j += 1) {
      const current = input[j];
      const previous = input[(j + input.length - 1) % input.length];

      const currentInside = isLeftOf(edgeStart, edgeEnd, current);
      const previousInside = isLeftOf(edgeStart, edgeEnd, previous);

      if (currentInside) {
        if (!previousInside) {
          const intersection = lineIntersection(previous, current, edgeStart, edgeEnd);
          if (intersection) output.push(intersection);
        }
        output.push(current);
      } else if (previousInside) {
        const intersection = lineIntersection(previous, current, edgeStart, edgeEnd);
        if (intersection) output.push(intersection);
      }
    }
  }

  return output;
}

function normalizeRingOrientation(
  ring: readonly MapGeoPoint[],
): MapGeoPoint[] {
  if (ring.length < 3) {
    return [...ring];
  }

  return signedArea(ring) < 0 ? [...ring].reverse() : [...ring];
}

function signedArea(ring: readonly MapGeoPoint[]): number {
  let area = 0;

  for (let index = 0; index < ring.length; index += 1) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[(index + 1) % ring.length];
    area += x1 * y2 - x2 * y1;
  }

  return area / 2;
}

/** True if point is on the left side (inside) of directed edge a→b. */
function isLeftOf(
  a: readonly [number, number],
  b: readonly [number, number],
  p: readonly [number, number],
): boolean {
  return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= 0;
}

/** Line segment intersection (parametric). */
function lineIntersection(
  p1: MapGeoPoint,
  p2: MapGeoPoint,
  p3: MapGeoPoint,
  p4: MapGeoPoint,
): MapGeoPoint | null {
  const x1 = p1[0], y1 = p1[1];
  const x2 = p2[0], y2 = p2[1];
  const x3 = p3[0], y3 = p3[1];
  const x4 = p4[0], y4 = p4[1];

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 1e-12) return null;

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;

  return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];
}

/**
 * Inset a polygon by shrinking it towards its centroid.
 *
 * `ratio` is the fraction to shrink — 0.0 = no change, 0.04 = 4 % inset.
 * This is a simple centroid-relative inset, not a true offset curve, but
 * works well for the small gaps needed between grid cells.
 */
export function insetPolygon(
  polygon: MapGeoPoint[],
  ratio: number,
): MapGeoPoint[] {
  if (polygon.length === 0 || ratio <= 0) return polygon;

  let cx = 0;
  let cy = 0;
  // Exclude closing vertex if ring is closed.
  const len =
    polygon.length > 1 &&
    polygon[0][0] === polygon[polygon.length - 1][0] &&
    polygon[0][1] === polygon[polygon.length - 1][1]
      ? polygon.length - 1
      : polygon.length;

  for (let i = 0; i < len; i += 1) {
    cx += polygon[i][0];
    cy += polygon[i][1];
  }
  cx /= len;
  cy /= len;

  return polygon.map(([x, y]) => [
    cx + (x - cx) * (1 - ratio),
    cy + (y - cy) * (1 - ratio),
  ]);
}
