import type { CellAnomalyClass } from "../domain/render/FieldAgronomicSurfaceRenderModel";

export function formatCellPercentile(percentileInField: number | null | undefined) {
  if (!Number.isFinite(percentileInField)) {
    return "P—";
  }

  return `P${Math.round(percentileInField!)}`;
}

export function describeCellAnomalyClass(
  anomalyClass: CellAnomalyClass | null | undefined,
) {
  switch (anomalyClass) {
    case "above-field":
      return "above field";
    case "below-field":
      return "below field";
    case "near-field":
      return "near field";
    default:
      return "field-relative";
  }
}
