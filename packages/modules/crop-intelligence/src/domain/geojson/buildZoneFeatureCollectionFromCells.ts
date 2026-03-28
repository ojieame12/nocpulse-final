import type { JsonValue } from "@fieldpulse/platform-db";
import type { GridCellCluster } from "../zones/clusterGridCells";

type CellBoundaryLike = {
  type: "Polygon";
  coordinates: readonly (readonly (readonly [number, number])[])[];
};

type GridBoundaryCell = {
  cellKey: string;
  rowIndex: number;
  columnIndex: number;
  boundary: CellBoundaryLike;
};

export function buildZoneFeatureCollectionFromCells<TCell extends GridBoundaryCell>(
  clusters: readonly GridCellCluster<TCell>[],
): JsonValue | null {
  if (clusters.length === 0) {
    return null;
  }

  return {
    type: "FeatureCollection",
    features: clusters.map((cluster) => ({
      type: "Feature",
      id: cluster.zoneKey,
      properties: {
        zoneKey: cluster.zoneKey,
        cellCount: cluster.cells.length,
        rowStart: cluster.rowStart,
        rowEnd: cluster.rowEnd,
        columnStart: cluster.columnStart,
        columnEnd: cluster.columnEnd,
      },
      geometry: {
        type: "MultiPolygon",
        coordinates: cluster.cells.map((cell) => [cell.boundary.coordinates]),
      },
    })),
  };
}
