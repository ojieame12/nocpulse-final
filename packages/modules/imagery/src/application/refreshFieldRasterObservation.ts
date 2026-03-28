import type { EntityId, TimestampIso, WorkspaceId } from "@fieldpulse/platform-db";
import type { RasterMultiPolygon } from "@fieldpulse/raster";
import type { FieldRasterObservation } from "../contracts/FieldRasterObservation";
import type { FieldRasterObservationProvider } from "../contracts/FieldRasterObservationProvider";
import type { FieldRasterObservationRepository } from "../contracts/FieldRasterObservationRepository";

export type RefreshFieldRasterObservationInput = {
  repository: FieldRasterObservationRepository;
  provider: FieldRasterObservationProvider;
  workspaceId: WorkspaceId;
  fieldId: EntityId;
  boundary: RasterMultiPolygon;
  observedAt: TimestampIso;
};

export type RefreshFieldRasterObservationResult = {
  action: "replaced";
  observation: FieldRasterObservation;
};

export async function refreshFieldRasterObservation(
  input: RefreshFieldRasterObservationInput,
): Promise<RefreshFieldRasterObservationResult> {
  const observed = await input.provider.observeFieldRaster({
    workspaceId: input.workspaceId,
    fieldId: input.fieldId,
    boundary: input.boundary,
    observedAt: input.observedAt,
  });

  if (!observed || observed.cells.length === 0) {
    throw new Error(
      `[imagery] no raster observation cells produced for field ${input.fieldId}`,
    );
  }

  const providerKey =
    observed.sourceKey.split(":").slice(1).join(":") || observed.sourceKey;

  return {
    action: "replaced",
    observation: await input.repository.replaceObservation({
      workspaceId: input.workspaceId,
      fieldId: input.fieldId,
      observedAt: input.observedAt,
      sourceKey: observed.sourceKey,
      providerKey,
      artifactKey: null,
      metadata: {
        mode: "synthetic-seeded",
      },
      cells: observed.cells,
    }),
  };
}
