import type { JsonValue } from "@fieldpulse/platform-db";

type GeoPoint = readonly [longitude: number, latitude: number];
type GeoRing = readonly GeoPoint[];
type GeoPolygon = readonly GeoRing[];
type GeoMultiPolygon = readonly GeoPolygon[];

function isRecord(value: JsonValue): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isGeoPoint(value: JsonValue): value is GeoPoint {
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

function isPointInRing(point: GeoPoint, ring: GeoRing): boolean {
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

function isPointInPolygon(point: GeoPoint, polygon: GeoPolygon): boolean {
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

export function isPointInPolygonalGeoJson(
  point: GeoPoint,
  geometry: JsonValue,
): boolean {
  const polygons = extractPolygonCollection(geometry);

  if (!polygons) {
    return false;
  }

  return polygons.some((polygon) => isPointInPolygon(point, polygon));
}

export function isPolygonalGeoJson(geometry: JsonValue): boolean {
  return extractPolygonCollection(geometry) !== null;
}
