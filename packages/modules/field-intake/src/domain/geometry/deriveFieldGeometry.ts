import type { FieldBoundary, GeoPoint } from "@fieldpulse/module-fields";
import type { GeoBoundingBox } from "../../contracts/LldLookupResult";

export type FieldGeometry = {
  areaHa: number;
  centroid: GeoPoint;
  bbox: GeoBoundingBox;
};

export function deriveFieldGeometry(boundary: FieldBoundary): FieldGeometry {
  const points = boundary.coordinates.flatMap((polygon) =>
    polygon.flatMap((ring) => ring),
  );

  if (points.length === 0) {
    throw new Error("[field-intake] field boundary does not contain any points");
  }

  const bbox = points.reduce<GeoBoundingBox>(
    (current, [lng, lat]) => ({
      west: Math.min(current.west, lng),
      south: Math.min(current.south, lat),
      east: Math.max(current.east, lng),
      north: Math.max(current.north, lat),
    }),
    {
      west: points[0][0],
      south: points[0][1],
      east: points[0][0],
      north: points[0][1],
    },
  );

  const centroid = [
    (bbox.west + bbox.east) / 2,
    (bbox.south + bbox.north) / 2,
  ] as const satisfies GeoPoint;

  const areaM2 = boundary.coordinates.reduce((sum, polygon) => {
    if (polygon.length === 0) {
      return sum;
    }

    const shellArea = Math.abs(getRingAreaM2(polygon[0], centroid[1]));
    const holeArea = polygon
      .slice(1)
      .reduce((holeSum, ring) => holeSum + Math.abs(getRingAreaM2(ring, centroid[1])), 0);

    return sum + Math.max(0, shellArea - holeArea);
  }, 0);

  return {
    areaHa: areaM2 / 10_000,
    centroid,
    bbox,
  };
}

function getRingAreaM2(
  ring: readonly GeoPoint[],
  referenceLatitude: number,
) {
  const closedRing = isRingClosed(ring) ? ring : [...ring, ring[0]];

  if (closedRing.length < 4) {
    return 0;
  }

  let area = 0;

  for (let index = 0; index < closedRing.length - 1; index += 1) {
    const [x1, y1] = projectToMeters(closedRing[index], referenceLatitude);
    const [x2, y2] = projectToMeters(closedRing[index + 1], referenceLatitude);
    area += x1 * y2 - x2 * y1;
  }

  return Math.abs(area) / 2;
}

function isRingClosed(ring: readonly GeoPoint[]) {
  if (ring.length < 2) {
    return false;
  }

  const first = ring[0];
  const last = ring[ring.length - 1];

  return first[0] === last[0] && first[1] === last[1];
}

function projectToMeters(
  point: GeoPoint,
  referenceLatitude: number,
) {
  const metersPerLatDegree = 111_320;
  const metersPerLngDegree =
    111_320 * Math.cos((referenceLatitude * Math.PI) / 180);

  return [
    point[0] * metersPerLngDegree,
    point[1] * metersPerLatDegree,
  ] as const;
}
