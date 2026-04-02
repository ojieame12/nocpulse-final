import type {
  FieldAgronomicAlternateCellRenderModel,
  FieldAgronomicCellRenderModel,
} from "@fieldpulse/map";

function formatCentroidKey([longitude, latitude]: readonly [number, number]) {
  return `${longitude.toFixed(6)}:${latitude.toFixed(6)}`;
}

export function buildAlternateSurfaceCellDictionary(input: {
  primaryCells: readonly Pick<FieldAgronomicCellRenderModel, "id" | "centroid">[];
  alternateCells: readonly FieldAgronomicCellRenderModel[];
}): Record<string, FieldAgronomicAlternateCellRenderModel> {
  const primaryIdByCentroid = new Map(
    input.primaryCells.map((cell) => [formatCentroidKey(cell.centroid), cell.id]),
  );

  const cells: Record<string, FieldAgronomicAlternateCellRenderModel> = {};

  for (const cell of input.alternateCells) {
    const { polygon, centroid, ...rest } = cell;
    const remappedId =
      primaryIdByCentroid.get(formatCentroidKey(centroid)) ?? cell.id;
    cells[remappedId] = rest;
  }

  return cells;
}
