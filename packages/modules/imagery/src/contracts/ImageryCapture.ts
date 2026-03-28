import type {
  EntityId,
  TimestampIso,
  WorkspaceScoped,
} from "@fieldpulse/platform-db";
import type { ImageryProvider } from "./ImageryProvider";

export type ImageryCaptureStatus =
  | "dry-run"
  | "discovered"
  | "materialized"
  | "unavailable";

export type ImageryCaptureMetadata = Readonly<
  Record<string, string | number | boolean | null>
>;

export type ImageryCapture = WorkspaceScoped & {
  id: EntityId;
  fieldId: EntityId;
  requestedAt: TimestampIso;
  capturedAt: TimestampIso;
  providerKey: ImageryProvider;
  sceneKey: string;
  status: ImageryCaptureStatus;
  coveragePct: number;
  cloudCoverPct: number | null;
  note: string | null;
  metadata: ImageryCaptureMetadata;
  observationId: string | null;
  createdAt: TimestampIso;
};

export type UpsertImageryCaptureInput = WorkspaceScoped & {
  fieldId: EntityId;
  requestedAt: TimestampIso;
  capturedAt: TimestampIso;
  providerKey: ImageryProvider;
  sceneKey: string;
  status: ImageryCaptureStatus;
  coveragePct: number;
  cloudCoverPct?: number | null;
  note?: string | null;
  metadata?: ImageryCaptureMetadata;
  observationId?: string | null;
};
