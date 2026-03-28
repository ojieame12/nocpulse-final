import { getQuarterGridCell } from "./quarterGrid";
import type { ParsedSpreadsheetImportRow } from "./types";

export function buildConnectedRowGroups(
  rows: readonly ParsedSpreadsheetImportRow[],
) {
  const rowsByCell = new Map<string, ParsedSpreadsheetImportRow>();
  const visited = new Set<string>();

  for (const row of rows) {
    const cell = getQuarterGridCell(row.lldComponents);
    rowsByCell.set(`${cell.meridian}:${cell.x},${cell.y}`, row);
  }

  const components: ParsedSpreadsheetImportRow[][] = [];

  for (const row of rows) {
    const origin = getQuarterGridCell(row.lldComponents);
    const originKey = `${origin.meridian}:${origin.x},${origin.y}`;

    if (visited.has(originKey)) {
      continue;
    }

    const stack = [row];
    const component: ParsedSpreadsheetImportRow[] = [];

    while (stack.length > 0) {
      const current = stack.pop();

      if (!current) {
        continue;
      }

      const currentCell = getQuarterGridCell(current.lldComponents);
      const currentKey = `${currentCell.meridian}:${currentCell.x},${currentCell.y}`;

      if (visited.has(currentKey)) {
        continue;
      }

      visited.add(currentKey);
      component.push(current);

      const neighbors = [
        [currentCell.x - 1, currentCell.y],
        [currentCell.x + 1, currentCell.y],
        [currentCell.x, currentCell.y - 1],
        [currentCell.x, currentCell.y + 1],
      ];

      for (const [x, y] of neighbors) {
        const neighbor = rowsByCell.get(`${currentCell.meridian}:${x},${y}`);

        if (neighbor) {
          stack.push(neighbor);
        }
      }
    }

    components.push(sortSpreadsheetRows(component));
  }

  return components;
}

export function sortSpreadsheetRows(
  rows: readonly ParsedSpreadsheetImportRow[],
) {
  return [...rows].sort((left, right) => {
    if (right.lldComponents.township !== left.lldComponents.township) {
      return right.lldComponents.township - left.lldComponents.township;
    }

    if (left.lldComponents.range !== right.lldComponents.range) {
      return left.lldComponents.range - right.lldComponents.range;
    }

    if (left.lldComponents.section !== right.lldComponents.section) {
      return left.lldComponents.section - right.lldComponents.section;
    }

    return left.legalLandDescription.localeCompare(right.legalLandDescription);
  });
}
