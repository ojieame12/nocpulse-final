import type { ImageryProvider } from "./ImageryProvider";

export type ImageryProviderDiagnosticsStatus =
  | "ready"
  | "fallback"
  | "unavailable";

export type ImageryProviderFieldProbeStatus =
  | "provider-scene"
  | "fallback-scene"
  | "no-scene"
  | "error";

export type ImageryProviderDiagnostics = {
  provider: ImageryProvider;
  status: ImageryProviderDiagnosticsStatus;
  discoveryMode: string;
  materializationMode: string;
  discoveryClient: string | null;
  materializationClient: string | null;
  fallbackClient: string | null;
  reason: string | null;
  details: Readonly<Record<string, string | number | boolean | null>>;
};

export type ImageryProviderFieldProbe = {
  requestedAt: string;
  status: ImageryProviderFieldProbeStatus;
  sceneKey: string | null;
  capturedAt: string | null;
  discoveryMode: string | null;
  discoveryClient: string | null;
  reason: string | null;
  cachedQualityReuseHit?: boolean;
  cachedQualityObservedAt?: string | null;
  cachedQualitySourceKey?: string | null;
};

export type ImageryProviderFieldDiagnostics = ImageryProviderDiagnostics & {
  probe: ImageryProviderFieldProbe;
};
