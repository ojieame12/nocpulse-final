import type { FieldMoistureCellObservationSource } from "@fieldpulse/module-moisture";
import type { FieldRasterObservationProvider } from "./FieldRasterObservationProvider";
import { deriveRasterCellMoisture } from "../application/deriveRasterBackedMoisture";

type CreateRasterBackedFieldMoistureCellObservationSourceOptions = {
  provider: FieldRasterObservationProvider;
  sourceKey?: string;
};

export function createRasterBackedFieldMoistureCellObservationSource({
  provider,
  sourceKey = "imagery-raster-observation-v1",
}: CreateRasterBackedFieldMoistureCellObservationSourceOptions): FieldMoistureCellObservationSource {
  return {
    async observeCells(input) {
      const observed = await provider.observeFieldRaster({
        workspaceId: input.workspaceId,
        fieldId: input.fieldId,
        boundary: input.boundary,
        observedAt: input.snapshot.observedAt,
      });

      if (!observed || observed.cells.length === 0) {
        return null;
      }

      return {
        sourceKey: `${sourceKey}:${observed.sourceKey}`,
        cells: observed.cells.map((cell) => ({
          cellKey: cell.cellKey,
          rowIndex: cell.rowIndex,
          columnIndex: cell.columnIndex,
          centroid: cell.centroid,
          boundary: cell.boundary,
          ...deriveRasterCellMoisture(cell, {
            rootZonePct: input.snapshot.rootZonePct,
            surfacePct: input.snapshot.surfacePct,
          }),
        })),
      };
    },
  };
}
