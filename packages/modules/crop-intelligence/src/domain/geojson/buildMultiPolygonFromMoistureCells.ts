import type { JsonValue } from "@fieldpulse/platform-db";
import type { FieldMoistureCellSnapshot } from "@fieldpulse/module-moisture";

export function buildMultiPolygonFromMoistureCells(
  cells: readonly FieldMoistureCellSnapshot[],
): JsonValue | null {
  if (cells.length === 0) {
    return null;
  }

  return {
    type: "MultiPolygon",
    coordinates: cells.map((cell) => [cell.boundary.coordinates]),
  };
}
