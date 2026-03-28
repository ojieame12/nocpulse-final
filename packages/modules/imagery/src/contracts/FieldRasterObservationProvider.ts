import type { EntityId, WorkspaceId } from "@fieldpulse/platform-db";
import type { RasterFieldGridObservation, RasterMultiPolygon } from "@fieldpulse/raster";

export type FieldRasterObservationInput = {
  workspaceId: WorkspaceId;
  fieldId: EntityId;
  boundary: RasterMultiPolygon;
  observedAt: string;
  targetCellCount?: number;
};

export type FieldRasterObservationProvider = {
  observeFieldRaster(
    input: FieldRasterObservationInput,
  ): Promise<RasterFieldGridObservation | null> | RasterFieldGridObservation | null;
};
