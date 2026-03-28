import type {
  EntityId,
  TimestampIso,
  WorkspaceScoped,
} from "@fieldpulse/platform-db";
import type { RasterFieldGridCell } from "@fieldpulse/raster";

export type FieldRasterObservationMetadata = Readonly<
  Record<string, string | number | boolean | null>
>;

export type FieldRasterObservation = WorkspaceScoped & {
  id: EntityId;
  fieldId: EntityId;
  observedAt: TimestampIso;
  sourceKey: string;
  providerKey: string;
  artifactKey: string | null;
  metadata: FieldRasterObservationMetadata;
  cells: readonly RasterFieldGridCell[];
  createdAt: TimestampIso;
};

export type ReplaceFieldRasterObservationInput = WorkspaceScoped & {
  fieldId: EntityId;
  observedAt: TimestampIso;
  sourceKey: string;
  providerKey: string;
  artifactKey?: string | null;
  metadata?: FieldRasterObservationMetadata;
  cells: readonly RasterFieldGridCell[];
};
