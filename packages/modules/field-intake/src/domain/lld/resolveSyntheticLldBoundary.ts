import type { FieldBoundary, GeoPoint } from "@fieldpulse/module-fields";
import type { GeoBoundingBox } from "../../contracts/LldLookupResult";
import type { LldComponents } from "../../contracts/LldComponents";
import {
  MERIDIAN_BASES,
  QUARTER_AREA_HA,
  QUARTER_WIDTH_M,
  SECTION_WIDTH_M,
} from "./constants";

export type SyntheticLldBoundary = {
  boundary: FieldBoundary;
  centroid: GeoPoint;
  bbox: GeoBoundingBox;
  areaHa: number;
};

export function resolveSyntheticLldBoundary(
  components: LldComponents,
): SyntheticLldBoundary {
  const sectionCenter = getSectionCenter(components);
  const quarterCenter = offsetQuarter(sectionCenter, components.quarter);

  return buildQuarterBoundary(quarterCenter);
}

function getSectionCenter(components: LldComponents) {
  const base = MERIDIAN_BASES[`W${components.meridian}`];
  const townshipIndex = components.township - 1;
  const rangeIndex = components.range - 1;
  const sectionIndex = components.section - 1;
  const sectionRow = Math.floor(sectionIndex / 6);
  const positionInRow = sectionIndex % 6;
  const sectionColumn =
    sectionRow % 2 === 0 ? 5 - positionInRow : positionInRow;

  const northingM =
    townshipIndex * SECTION_WIDTH_M * 6 + (sectionRow + 0.5) * SECTION_WIDTH_M;
  const westingM =
    rangeIndex * SECTION_WIDTH_M * 6 + (sectionColumn + 0.5) * SECTION_WIDTH_M;

  const lat = base.lat + metersToLatDegrees(northingM);
  const lng = base.lng - metersToLngDegrees(westingM, lat);

  return [lng, lat] as const satisfies GeoPoint;
}

function offsetQuarter(center: GeoPoint, quarter: LldComponents["quarter"]): GeoPoint {
  const northOffsetM =
    quarter.startsWith("N") ? SECTION_WIDTH_M / 4 : -SECTION_WIDTH_M / 4;
  const eastOffsetM =
    quarter.endsWith("E") ? SECTION_WIDTH_M / 4 : -SECTION_WIDTH_M / 4;

  const [lng, lat] = center;

  return [
    lng + metersToLngDegrees(eastOffsetM, lat),
    lat + metersToLatDegrees(northOffsetM),
  ] as const satisfies GeoPoint;
}

function buildQuarterBoundary(center: GeoPoint): SyntheticLldBoundary {
  const [lng, lat] = center;
  const halfHeight = metersToLatDegrees(QUARTER_WIDTH_M / 2);
  const halfWidth = metersToLngDegrees(QUARTER_WIDTH_M / 2, lat);

  const northWest = [lng - halfWidth, lat + halfHeight] as const satisfies GeoPoint;
  const northEast = [lng + halfWidth, lat + halfHeight] as const satisfies GeoPoint;
  const southEast = [lng + halfWidth, lat - halfHeight] as const satisfies GeoPoint;
  const southWest = [lng - halfWidth, lat - halfHeight] as const satisfies GeoPoint;

  return {
    boundary: {
      type: "MultiPolygon",
      coordinates: [[[
        northWest,
        northEast,
        southEast,
        southWest,
        northWest,
      ]]],
    },
    centroid: center,
    bbox: {
      west: northWest[0],
      north: northWest[1],
      east: southEast[0],
      south: southEast[1],
    },
    areaHa: QUARTER_AREA_HA,
  };
}

function metersToLatDegrees(meters: number) {
  return meters / 111_320;
}

function metersToLngDegrees(meters: number, latitude: number) {
  return meters / (111_320 * Math.cos((latitude * Math.PI) / 180));
}
