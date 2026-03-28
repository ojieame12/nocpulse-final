import type { FieldMoistureCellSnapshot } from "@fieldpulse/module-moisture";

function roundTo(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function getWetnessScore(cell: FieldMoistureCellSnapshot) {
  return roundTo(cell.surfacePct * 0.65 + cell.rootZonePct * 0.35, 3);
}

export function selectDiseaseRiskCells(
  cells: readonly FieldMoistureCellSnapshot[],
): readonly FieldMoistureCellSnapshot[] {
  if (cells.length === 0) {
    return [];
  }

  const scored = cells
    .map((cell) => ({
      cell,
      score: getWetnessScore(cell),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if (left.cell.rowIndex !== right.cell.rowIndex) {
        return left.cell.rowIndex - right.cell.rowIndex;
      }

      if (left.cell.columnIndex !== right.cell.columnIndex) {
        return left.cell.columnIndex - right.cell.columnIndex;
      }

      return left.cell.cellKey.localeCompare(right.cell.cellKey);
    });
  const cutoffIndex = Math.max(0, Math.ceil(scored.length * 0.25) - 1);
  const cutoffScore = scored[cutoffIndex]?.score ?? scored[0]!.score;

  return scored
    .filter((entry) => entry.score >= cutoffScore)
    .map((entry) => entry.cell);
}
