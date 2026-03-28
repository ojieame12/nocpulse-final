import type {
  MapGeoPoint,
  MapMultiPolygon,
} from "../render/FieldBoundaryPreviewRenderModel";

function isPointInRing(
  point: MapGeoPoint,
  ring: readonly MapGeoPoint[],
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

function isPointInPolygon(
  point: MapGeoPoint,
  polygon: readonly (readonly MapGeoPoint[])[],
): boolean {
  if (polygon.length === 0) {
    return false;
  }

  if (!isPointInRing(point, polygon[0])) {
    return false;
  }

  for (let index = 1; index < polygon.length; index += 1) {
    if (isPointInRing(point, polygon[index])) {
      return false;
    }
  }

  return true;
}

export function isPointInMultiPolygon(
  point: MapGeoPoint,
  geometry: MapMultiPolygon,
): boolean {
  return geometry.coordinates.some((polygon) => isPointInPolygon(point, polygon));
}
