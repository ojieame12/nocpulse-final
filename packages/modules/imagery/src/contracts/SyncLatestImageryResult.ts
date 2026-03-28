import type { EntityId, TimestampIso, WorkspaceScoped } from "@fieldpulse/platform-db";
import type { ImageryProvider } from "./ImageryProvider";
import type { ImageryCaptureStatus } from "./ImageryCapture";

export type SyncLatestImageryResult = WorkspaceScoped & {
  fieldId: EntityId;
  requestedAt: TimestampIso;
  providers: readonly ImageryProvider[];
  status: ImageryCaptureStatus;
  note: string;
  capture?: {
    captureId: string;
    providerKey: ImageryProvider;
    sceneKey: string;
    capturedAt: TimestampIso;
    coveragePct: number;
    cloudCoverPct: number | null;
    discoveryMode: string | null;
    discoveryClient: string | null;
    discoveryFallbackReason: string | null;
  };
  materializedObservation?: {
    sourceKey: string;
    providerKey: string;
    cellCount: number;
    observedAt: TimestampIso;
    artifactKey: string | null;
    materializationMode: string | null;
    materializationClient: string | null;
    materializationFallbackReason: string | null;
  };
};
