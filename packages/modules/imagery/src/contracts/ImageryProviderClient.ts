import type { EntityId, TimestampIso, WorkspaceId } from "@fieldpulse/platform-db";
import type { RasterFieldGridObservation, RasterMultiPolygon } from "@fieldpulse/raster";
import type { ImageryProvider } from "./ImageryProvider";
import type { ImageryProviderDiagnostics } from "./ImageryProviderDiagnostics";
import type { ImageryScene } from "./ImageryScene";
import type { FieldRasterObservationMetadata } from "./FieldRasterObservation";
import type { ImageryCaptureMetadata } from "./ImageryCapture";

export type DiscoverLatestImagerySceneInput = {
  workspaceId: WorkspaceId;
  fieldId: EntityId;
  boundary: RasterMultiPolygon;
  requestedAt: TimestampIso;
};

export type MaterializeImagerySceneInput = {
  workspaceId: WorkspaceId;
  fieldId: EntityId;
  boundary: RasterMultiPolygon;
  requestedAt: TimestampIso;
  scene: ImageryScene;
};

export type DiscoveredImagerySceneResult = {
  scene: ImageryScene;
  metadata?: ImageryCaptureMetadata;
  note?: string | null;
};

export type MaterializedFieldObservationResult = {
  observation: RasterFieldGridObservation;
  artifactKey?: string | null;
  metadata?: FieldRasterObservationMetadata;
  note?: string | null;
};

export type ImageryProviderClient = {
  provider: ImageryProvider;
  healthcheck(): Promise<boolean>;
  diagnose(): Promise<ImageryProviderDiagnostics>;
  discoverLatestScene(
    input: DiscoverLatestImagerySceneInput,
  ): Promise<DiscoveredImagerySceneResult | null>;
  materializeFieldObservation(
    input: MaterializeImagerySceneInput,
  ): Promise<MaterializedFieldObservationResult | null>;
};
