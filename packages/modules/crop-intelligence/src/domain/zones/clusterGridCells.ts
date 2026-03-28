type GridCellLike = {
  cellKey: string;
  rowIndex: number;
  columnIndex: number;
};

export type GridCellCluster<TCell extends GridCellLike> = {
  zoneKey: string;
  cells: readonly TCell[];
  rowStart: number;
  rowEnd: number;
  columnStart: number;
  columnEnd: number;
};

function compareCells(left: GridCellLike, right: GridCellLike) {
  if (left.rowIndex !== right.rowIndex) {
    return left.rowIndex - right.rowIndex;
  }

  if (left.columnIndex !== right.columnIndex) {
    return left.columnIndex - right.columnIndex;
  }

  return left.cellKey.localeCompare(right.cellKey);
}

type RawGridCellCluster<TCell extends GridCellLike> = Omit<
  GridCellCluster<TCell>,
  "zoneKey"
>;

function compareClusters<TCell extends GridCellLike>(
  left: RawGridCellCluster<TCell>,
  right: RawGridCellCluster<TCell>,
) {
  if (right.cells.length !== left.cells.length) {
    return right.cells.length - left.cells.length;
  }

  if (left.rowStart !== right.rowStart) {
    return left.rowStart - right.rowStart;
  }

  if (left.columnStart !== right.columnStart) {
    return left.columnStart - right.columnStart;
  }

  return 0;
}

export function clusterGridCells<TCell extends GridCellLike>(
  cells: readonly TCell[],
): readonly GridCellCluster<TCell>[] {
  if (cells.length === 0) {
    return [];
  }

  const cellByCoordinate = new Map<string, TCell>();

  for (const cell of cells) {
    cellByCoordinate.set(`${cell.rowIndex}:${cell.columnIndex}`, cell);
  }

  const visited = new Set<string>();
  const rawClusters: RawGridCellCluster<TCell>[] = [];

  for (const cell of [...cells].sort(compareCells)) {
    if (visited.has(cell.cellKey)) {
      continue;
    }

    const queue = [cell];
    const clusterCells: TCell[] = [];
    let rowStart = cell.rowIndex;
    let rowEnd = cell.rowIndex;
    let columnStart = cell.columnIndex;
    let columnEnd = cell.columnIndex;
    visited.add(cell.cellKey);

    while (queue.length > 0) {
      const current = queue.shift()!;
      clusterCells.push(current);
      rowStart = Math.min(rowStart, current.rowIndex);
      rowEnd = Math.max(rowEnd, current.rowIndex);
      columnStart = Math.min(columnStart, current.columnIndex);
      columnEnd = Math.max(columnEnd, current.columnIndex);

      const neighbors = [
        [current.rowIndex - 1, current.columnIndex],
        [current.rowIndex + 1, current.columnIndex],
        [current.rowIndex, current.columnIndex - 1],
        [current.rowIndex, current.columnIndex + 1],
      ];

      for (const [rowIndex, columnIndex] of neighbors) {
        const neighbor = cellByCoordinate.get(`${rowIndex}:${columnIndex}`);

        if (!neighbor || visited.has(neighbor.cellKey)) {
          continue;
        }

        visited.add(neighbor.cellKey);
        queue.push(neighbor);
      }
    }

    rawClusters.push({
      cells: clusterCells.sort(compareCells),
      rowStart,
      rowEnd,
      columnStart,
      columnEnd,
    });
  }

  return rawClusters
    .sort(compareClusters)
    .map((cluster, index) => ({
      zoneKey: `zone-${index + 1}`,
      ...cluster,
    }));
}
