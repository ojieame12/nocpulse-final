import type { Audited, EntityId, TimestampIso, WorkspaceScoped } from "@fieldpulse/platform-db";
import type {
  ImageryProviderDiagnosticsStatus,
  ImageryProviderFieldProbeStatus,
} from "./ImageryProviderDiagnostics";
import type { ImageryProvider } from "./ImageryProvider";

export type ImageryProviderProbeRecord = WorkspaceScoped &
  Audited & {
    id: EntityId;
    fieldId: EntityId;
    provider: ImageryProvider;
    requestedAt: TimestampIso;
    providerStatus: ImageryProviderDiagnosticsStatus;
    discoveryMode: string;
    materializationMode: string;
    discoveryClient: string | null;
    materializationClient: string | null;
    fallbackClient: string | null;
    reason: string | null;
    probeStatus: ImageryProviderFieldProbeStatus;
    probeSceneKey: string | null;
    probeCapturedAt: TimestampIso | null;
    probeDiscoveryMode: string | null;
    probeDiscoveryClient: string | null;
    probeReason: string | null;
    details: Readonly<Record<string, string | number | boolean | null>>;
  };

export type CreateImageryProviderProbeRecordInput = WorkspaceScoped & {
  fieldId: EntityId;
  provider: ImageryProvider;
  requestedAt: TimestampIso;
  providerStatus: ImageryProviderDiagnosticsStatus;
  discoveryMode: string;
  materializationMode: string;
  discoveryClient?: string | null;
  materializationClient?: string | null;
  fallbackClient?: string | null;
  reason?: string | null;
  probeStatus: ImageryProviderFieldProbeStatus;
  probeSceneKey?: string | null;
  probeCapturedAt?: TimestampIso | null;
  probeDiscoveryMode?: string | null;
  probeDiscoveryClient?: string | null;
  probeReason?: string | null;
  details?: Readonly<Record<string, string | number | boolean | null>>;
};
