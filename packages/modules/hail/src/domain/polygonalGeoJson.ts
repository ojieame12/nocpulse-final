import type { JsonValue } from "@fieldpulse/platform-db";
import type { HailGeoPoint, HailMultiPolygonGeoJson } from "./../contracts/HailProviderClient";

type GeoRing = readonly HailGeoPoint[];
type GeoPolygon = readonly GeoRing[];
type GeoMultiPolygon = readonly GeoPolygon[];
type GeoBoundingBox = readonly [
  west: number,
  south: number,
  east: number,
  north: number,
];

function isRecord(value: JsonValue): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isGeoPoint(value: JsonValue): value is HailGeoPoint {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number"
  );
}

function isGeoRing(value: JsonValue): value is GeoRing {
  return Array.isArray(value) && value.every((point) => isGeoPoint(point));
}

function isGeoPolygon(value: JsonValue): value is GeoPolygon {
  return Array.isArray(value) && value.every((ring) => isGeoRing(ring));
}

function isGeoMultiPolygon(value: JsonValue): value is GeoMultiPolygon {
  return Array.isArray(value) && value.every((polygon) => isGeoPolygon(polygon));
}

function extractPolygonCollection(value: JsonValue): GeoMultiPolygon | null {
  if (!isRecord(value) || typeof value.type !== "string") {
    return null;
  }

  switch (value.type) {
    case "Polygon":
      return isGeoPolygon(value.coordinates) ? [value.coordinates] : null;
    case "MultiPolygon":
      return isGeoMultiPolygon(value.coordinates) ? value.coordinates : null;
    case "Feature":
      return "geometry" in value
        ? extractPolygonCollection(value.geometry as JsonValue)
        : null;
    case "FeatureCollection":
      if (!Array.isArray(value.features)) {
        return null;
      }

      return value.features.reduce<GeoMultiPolygon | null>((collection, feature) => {
        const geometry = extractPolygonCollection(feature as JsonValue);

        if (!geometry) {
          return collection;
        }

        return [...(collection ?? []), ...geometry];
      }, null);
    default:
      return null;
  }
}

function isPointInRing(point: HailGeoPoint, ring: GeoRing): boolean {
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

function isPointInPolygon(point: HailGeoPoint, polygon: GeoPolygon): boolean {
  if (polygon.length === 0 || !isPointInRing(point, polygon[0])) {
    return false;
  }

  for (let index = 1; index < polygon.length; index += 1) {
    if (isPointInRing(point, polygon[index])) {
      return false;
    }
  }

  return true;
}

function orientation(
  first: HailGeoPoint,
  second: HailGeoPoint,
  third: HailGeoPoint,
) {
  return (
    (second[1] - first[1]) * (third[0] - second[0]) -
    (second[0] - first[0]) * (third[1] - second[1])
  );
}

function onSegment(
  first: HailGeoPoint,
  second: HailGeoPoint,
  point: HailGeoPoint,
) {
  return (
    Math.min(first[0], second[0]) <= point[0] &&
    point[0] <= Math.max(first[0], second[0]) &&
    Math.min(first[1], second[1]) <= point[1] &&
    point[1] <= Math.max(first[1], second[1])
  );
}

function segmentsIntersect(
  firstStart: HailGeoPoint,
  firstEnd: HailGeoPoint,
  secondStart: HailGeoPoint,
  secondEnd: HailGeoPoint,
) {
  const o1 = orientation(firstStart, firstEnd, secondStart);
  const o2 = orientation(firstStart, firstEnd, secondEnd);
  const o3 = orientation(secondStart, secondEnd, firstStart);
  const o4 = orientation(secondStart, secondEnd, firstEnd);

  if ((o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0)) {
    return true;
  }

  if (o1 === 0 && onSegment(firstStart, firstEnd, secondStart)) {
    return true;
  }
  if (o2 === 0 && onSegment(firstStart, firstEnd, secondEnd)) {
    return true;
  }
  if (o3 === 0 && onSegment(secondStart, secondEnd, firstStart)) {
    return true;
  }
  if (o4 === 0 && onSegment(secondStart, secondEnd, firstEnd)) {
    return true;
  }

  return false;
}

function ringsIntersect(first: GeoRing, second: GeoRing): boolean {
  for (let firstIndex = 0; firstIndex < first.length - 1; firstIndex += 1) {
    const firstStart = first[firstIndex];
    const firstEnd = first[firstIndex + 1];

    for (let secondIndex = 0; secondIndex < second.length - 1; secondIndex += 1) {
      const secondStart = second[secondIndex];
      const secondEnd = second[secondIndex + 1];

      if (segmentsIntersect(firstStart, firstEnd, secondStart, secondEnd)) {
        return true;
      }
    }
  }

  return false;
}

function polygonsIntersect(first: GeoPolygon, second: GeoPolygon): boolean {
  const firstOuterRing = first[0];
  const secondOuterRing = second[0];

  if (!firstOuterRing || !secondOuterRing) {
    return false;
  }

  if (firstOuterRing.some((point) => isPointInPolygon(point, second))) {
    return true;
  }

  if (secondOuterRing.some((point) => isPointInPolygon(point, first))) {
    return true;
  }

  return ringsIntersect(firstOuterRing, secondOuterRing);
}

export function deriveBoundingBox(
  geometry: HailMultiPolygonGeoJson,
): GeoBoundingBox {
  let west = Number.POSITIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;

  for (const polygon of geometry.coordinates) {
    for (const ring of polygon) {
      for (const [longitude, latitude] of ring) {
        west = Math.min(west, longitude);
        south = Math.min(south, latitude);
        east = Math.max(east, longitude);
        north = Math.max(north, latitude);
      }
    }
  }

  return [west, south, east, north];
}

export function intersectsPolygonalGeoJson(
  first: HailMultiPolygonGeoJson,
  second: JsonValue,
): boolean {
  const secondPolygons = extractPolygonCollection(second);

  if (!secondPolygons) {
    return false;
  }

  return first.coordinates.some((firstPolygon) =>
    secondPolygons.some((secondPolygon) =>
      polygonsIntersect(firstPolygon, secondPolygon),
    ),
  );
}
