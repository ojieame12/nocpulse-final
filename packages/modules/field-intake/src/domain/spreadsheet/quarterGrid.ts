import type { GeoPoint } from "@fieldpulse/module-fields";
import type { LldComponents } from "../../contracts/LldComponents";
import {
  MERIDIAN_BASES,
  QUARTER_WIDTH_M,
  SECTION_WIDTH_M,
} from "../lld/constants";
import type { GridCell, PlanarPoint } from "./types";

export function getQuarterGridCell(components: LldComponents): GridCell {
  const { sectionRow, sectionColumn } = getSectionGridPosition(components);
  const quarterX = components.quarter.endsWith("E") ? 1 : 0;
  const quarterY = components.quarter.startsWith("N") ? 1 : 0;

  return {
    x: (components.range - 1) * 12 + sectionColumn * 2 + quarterX,
    y: (components.township - 1) * 12 + sectionRow * 2 + quarterY,
    meridian: components.meridian,
  };
}

export function gridVertexToPlanarPoint(vertex: PlanarPoint): PlanarPoint {
  return [vertex[0] * QUARTER_WIDTH_M, vertex[1] * QUARTER_WIDTH_M];
}

export function projectPlanarPoint(
  point: PlanarPoint,
  meridian: number,
): GeoPoint {
  const base = MERIDIAN_BASES[`W${meridian}` as keyof typeof MERIDIAN_BASES];
  const lat = base.lat + metersToLatDegrees(point[1]);
  const lng = base.lng - metersToLngDegrees(point[0], lat);

  return [lng, lat] as const;
}

function getSectionGridPosition(components: LldComponents) {
  const townshipIndex = components.township - 1;
  const rangeIndex = components.range - 1;
  const sectionIndex = components.section - 1;
  const sectionRow = Math.floor(sectionIndex / 6);
  const positionInRow = sectionIndex % 6;
  const sectionColumn =
    sectionRow % 2 === 0 ? 5 - positionInRow : positionInRow;

  return {
    northingM:
      townshipIndex * SECTION_WIDTH_M * 6 +
      (sectionRow + 0.5) * SECTION_WIDTH_M,
    westingM:
      rangeIndex * SECTION_WIDTH_M * 6 +
      (sectionColumn + 0.5) * SECTION_WIDTH_M,
    sectionRow,
    sectionColumn,
  };
}

function metersToLatDegrees(meters: number) {
  return meters / 111_320;
}

function metersToLngDegrees(meters: number, latitude: number) {
  const latitudeRadians = (latitude * Math.PI) / 180;
  const metersPerDegree = 111_320 * Math.cos(latitudeRadians);

  if (Math.abs(metersPerDegree) < Number.EPSILON) {
    return 0;
  }

  return meters / metersPerDegree;
}
