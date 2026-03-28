import type { TimestampIso } from "@fieldpulse/platform-db";
import type {
  ImageryProviderDiagnosticsStatus,
  ImageryProviderFieldProbeStatus,
} from "./ImageryProviderDiagnostics";
import type { ImageryProvider } from "./ImageryProvider";

export type ImageryProviderProbeFieldLabel = {
  workspaceName?: string | null;
  workspaceSlug?: string | null;
  fieldName?: string | null;
};

export type ImageryProviderProbeFallbackReportProviderSummary = {
  provider: ImageryProvider;
  recordCount: number;
  affectedFieldCount: number;
  fallbackSceneCount: number;
  noSceneCount: number;
  errorCount: number;
  providerFallbackCount: number;
  cachedQualityReuseHitCount: number;
  latestCreatedAt: TimestampIso | null;
  reasons: readonly string[];
};

export type ImageryProviderProbeFallbackReportFieldIssue = {
  workspaceId: string;
  workspaceName: string | null;
  workspaceSlug: string | null;
  fieldId: string;
  fieldName: string | null;
  provider: ImageryProvider;
  providerStatus: ImageryProviderDiagnosticsStatus;
  probeStatus: ImageryProviderFieldProbeStatus;
  requestedAt: TimestampIso;
  createdAt: TimestampIso;
  reason: string | null;
  cachedQualityReuseHit: boolean;
};

export type ImageryProviderProbeFallbackReport = {
  generatedAt: TimestampIso;
  createdAfter: TimestampIso | null;
  totalRecordCount: number;
  fallbackRecordCount: number;
  affectedFieldCount: number;
  cachedQualityReuseHitCount: number;
  providerSummaries: readonly ImageryProviderProbeFallbackReportProviderSummary[];
  fieldIssues: readonly ImageryProviderProbeFallbackReportFieldIssue[];
};
