import type { MapGeoPoint, MapMultiPolygon } from "@fieldpulse/map/server";

function isFiniteCoordinateValue(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function toMapGeoPoint(value: unknown): MapGeoPoint | null {
  if (!Array.isArray(value) || value.length < 2) {
    return null;
  }

  const [longitude, latitude] = value;
  if (!isFiniteCoordinateValue(longitude) || !isFiniteCoordinateValue(latitude)) {
    return null;
  }

  return [longitude, latitude];
}

function toLinearRing(value: unknown): MapGeoPoint[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const ring: MapGeoPoint[] = [];
  for (const point of value) {
    const normalizedPoint = toMapGeoPoint(point);
    if (!normalizedPoint) {
      return null;
    }
    ring.push(normalizedPoint);
  }

  return ring;
}

function toPolygonCoordinates(value: unknown): MapGeoPoint[][] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const polygon: MapGeoPoint[][] = [];
  for (const ring of value) {
    const normalizedRing = toLinearRing(ring);
    if (!normalizedRing) {
      return null;
    }
    polygon.push(normalizedRing);
  }

  return polygon;
}

function toMultiPolygonCoordinates(value: unknown): MapGeoPoint[][][] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const multiPolygon: MapGeoPoint[][][] = [];
  for (const polygon of value) {
    const normalizedPolygon = toPolygonCoordinates(polygon);
    if (!normalizedPolygon) {
      return null;
    }
    multiPolygon.push(normalizedPolygon);
  }

  return multiPolygon;
}

export function toMapZoneMultiPolygon(value: unknown): MapMultiPolygon | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as {
    type?: unknown;
    coordinates?: unknown;
    geometry?: unknown;
    features?: unknown;
  };

  if (candidate.type === "FeatureCollection") {
    if (!Array.isArray(candidate.features)) {
      return null;
    }

    const coordinates: MapMultiPolygon["coordinates"] = [];
    for (const feature of candidate.features) {
      const geometry = toMapZoneMultiPolygon(feature);
      if (geometry) {
        coordinates.push(...geometry.coordinates);
      }
    }

    return coordinates.length > 0
      ? {
          type: "MultiPolygon",
          coordinates,
        }
      : null;
  }

  if (candidate.type === "Feature") {
    return toMapZoneMultiPolygon(candidate.geometry);
  }

  if (candidate.type === "Polygon") {
    const polygon = toPolygonCoordinates(candidate.coordinates);
    return polygon
      ? {
          type: "MultiPolygon",
          coordinates: [polygon],
        }
      : null;
  }

  if (candidate.type === "MultiPolygon") {
    const multiPolygon = toMultiPolygonCoordinates(candidate.coordinates);
    return multiPolygon
      ? {
          type: "MultiPolygon",
          coordinates: multiPolygon,
        }
      : null;
  }

  return null;
}
