import type { FieldBoundary, GeoPoint } from "@fieldpulse/module-fields";

export function coerceBoundaryFromGeoJson(input: unknown): {
  boundary: FieldBoundary;
  featureName: string | null;
} {
  const extracted = extractGeometryCandidate(input);

  return {
    boundary: normalizeGeometryToMultiPolygon(extracted.geometry),
    featureName: extracted.featureName,
  };
}

type GeometryCandidate = {
  geometry: unknown;
  featureName: string | null;
};

function extractGeometryCandidate(input: unknown): GeometryCandidate {
  if (!isRecord(input)) {
    throw new Error("[field-intake] file does not contain a valid GeoJSON object");
  }

  if (input.type === "FeatureCollection") {
    if (!Array.isArray(input.features)) {
      throw new Error("[field-intake] feature collection does not contain features");
    }

    for (const feature of input.features) {
      try {
        return extractGeometryCandidate(feature);
      } catch {
        continue;
      }
    }

    throw new Error(
      "[field-intake] no polygon or multipolygon geometry was found in the feature collection",
    );
  }

  if (input.type === "Feature") {
    const properties = isRecord(input.properties) ? input.properties : null;
    const featureName =
      typeof properties?.name === "string" ? properties.name : null;

    return {
      geometry: input.geometry,
      featureName,
    };
  }

  return {
    geometry: input,
    featureName: null,
  };
}

function normalizeGeometryToMultiPolygon(geometry: unknown): FieldBoundary {
  if (!isRecord(geometry) || typeof geometry.type !== "string") {
    throw new Error("[field-intake] geometry is missing or invalid");
  }

  if (geometry.type === "Polygon") {
    return {
      type: "MultiPolygon",
      coordinates: [coercePolygonCoordinates(geometry.coordinates)],
    };
  }

  if (geometry.type === "MultiPolygon") {
    if (!Array.isArray(geometry.coordinates)) {
      throw new Error("[field-intake] multipolygon coordinates are invalid");
    }

    return {
      type: "MultiPolygon",
      coordinates: geometry.coordinates.map(coercePolygonCoordinates),
    };
  }

  throw new Error(
    `[field-intake] expected Polygon or MultiPolygon geometry, received "${geometry.type}"`,
  );
}

function coercePolygonCoordinates(
  coordinates: unknown,
): readonly (readonly GeoPoint[])[] {
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    throw new Error("[field-intake] polygon coordinates are invalid");
  }

  return coordinates.map(coerceRingCoordinates);
}

function coerceRingCoordinates(coordinates: unknown): readonly GeoPoint[] {
  if (!Array.isArray(coordinates) || coordinates.length < 4) {
    throw new Error("[field-intake] polygon ring must contain at least four points");
  }

  return coordinates.map(coerceGeoPoint);
}

function coerceGeoPoint(coordinates: unknown): GeoPoint {
  if (
    !Array.isArray(coordinates)
    || coordinates.length < 2
    || typeof coordinates[0] !== "number"
    || typeof coordinates[1] !== "number"
  ) {
    throw new Error("[field-intake] invalid GeoJSON point coordinate");
  }

  return [coordinates[0], coordinates[1]] as const;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}
