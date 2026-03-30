import { deriveFieldGeometry } from "@fieldpulse/module-field-intake";
import type { FieldBoundary, GeoPoint } from "@fieldpulse/module-fields";

const METERS_PER_LATITUDE_DEGREE = 111_320;

export type ManualFieldDraftInput = {
  latitude: number;
  longitude: number;
  areaHa: number;
};

export function buildManualFieldDraft(input: ManualFieldDraftInput) {
  if (!Number.isFinite(input.latitude) || input.latitude < -90 || input.latitude > 90) {
    throw new Error("Latitude must be between -90 and 90.");
  }

  if (!Number.isFinite(input.longitude) || input.longitude < -180 || input.longitude > 180) {
    throw new Error("Longitude must be between -180 and 180.");
  }

  if (!Number.isFinite(input.areaHa) || input.areaHa <= 0) {
    throw new Error("Area must be a positive number of hectares.");
  }

  const boundary = buildApproximateBoundary(input);
  const geometry = deriveFieldGeometry(boundary);

  return {
    boundary,
    areaHa: geometry.areaHa,
    centroid: geometry.centroid,
    bbox: geometry.bbox,
  };
}

function buildApproximateBoundary(input: ManualFieldDraftInput): FieldBoundary {
  const areaM2 = input.areaHa * 10_000;
  const sideMeters = Math.sqrt(areaM2);
  const halfSideMeters = sideMeters / 2;
  const latitudeDelta = halfSideMeters / METERS_PER_LATITUDE_DEGREE;
  const longitudeDelta =
    halfSideMeters / Math.max(1, metersPerLongitudeDegree(input.latitude));

  const north = clampLatitude(input.latitude + latitudeDelta);
  const south = clampLatitude(input.latitude - latitudeDelta);
  const east = clampLongitude(input.longitude + longitudeDelta);
  const west = clampLongitude(input.longitude - longitudeDelta);

  const ring = [
    [west, north],
    [east, north],
    [east, south],
    [west, south],
    [west, north],
  ] as const satisfies readonly GeoPoint[];

  return {
    type: "MultiPolygon",
    coordinates: [[[...ring]]],
  };
}

function metersPerLongitudeDegree(latitude: number) {
  return METERS_PER_LATITUDE_DEGREE * Math.cos((latitude * Math.PI) / 180);
}

function clampLatitude(value: number) {
  return Math.max(-90, Math.min(90, value));
}

function clampLongitude(value: number) {
  if (value < -180) {
    return value + 360;
  }

  if (value > 180) {
    return value - 360;
  }

  return value;
}
