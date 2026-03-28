import type { FieldMoistureCellObservationSource } from "@fieldpulse/module-moisture";
import type { RasterFieldGridCell } from "@fieldpulse/raster";
import type { FieldRasterObservationProvider } from "./FieldRasterObservationProvider";

type CreateRasterBackedFieldMoistureCellObservationSourceOptions = {
  provider: FieldRasterObservationProvider;
  sourceKey?: string;
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function deriveCellMoisture(
  cell: RasterFieldGridCell,
  base: {
    rootZonePct: number;
    surfacePct: number;
  },
) {
  const sarWetness = cell.measurements.sarWetness ?? null;
  const sarRatio = cell.measurements.sarRatio ?? null;
  const ndmi = cell.measurements.ndmi ?? sarWetness ?? 0.5;
  const ndvi =
    cell.measurements.ndvi ??
    (sarRatio === null ? 0.5 : clamp(0.6 - (sarRatio - 0.5) * 0.18, 0, 1));
  const thermal =
    cell.measurements.thermal ??
    (sarWetness === null ? 0.5 : clamp(1 - sarWetness * 0.9, 0, 1));
  const shadow = cell.measurements.shadow ?? sarRatio ?? 0.5;

  const rootZonePct = clamp(
    base.rootZonePct +
      (ndmi - 0.5) * 38 +
      (ndvi - 0.5) * 12 -
      (thermal - 0.5) * 8 +
      (shadow - 0.5) * 4,
    0,
    100,
  );
  const surfacePct = clamp(
    base.surfacePct +
      (ndmi - 0.5) * 32 +
      (ndvi - 0.5) * 6 -
      (thermal - 0.5) * 14 -
      (shadow - 0.5) * 3,
    0,
    100,
  );

  return {
    rootZonePct: Number(rootZonePct.toFixed(2)),
    surfacePct: Number(surfacePct.toFixed(2)),
  };
}

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
          ...deriveCellMoisture(cell, {
            rootZonePct: input.snapshot.rootZonePct,
            surfacePct: input.snapshot.surfacePct,
          }),
        })),
      };
    },
  };
}
