import type { TimestampIso, WorkspaceId } from "@fieldpulse/platform-db";
import type { ImageryProvider } from "./ImageryProvider";
import type { ImageryCaptureStatus } from "./ImageryCapture";

export type ImagerySyncFieldLabel = {
  workspaceName?: string | null;
  workspaceSlug?: string | null;
  fieldName?: string | null;
};

export type ImagerySyncWorkspaceSummary = {
  workspaceId: WorkspaceId;
  workspaceName: string | null;
  workspaceSlug: string | null;
  providerKey: ImageryProvider;
  captureCount: number;
  refreshedFieldCount: number;
  materializedFieldCount: number;
  unavailableFieldCount: number;
  latestRequestedAt: TimestampIso | null;
  latestCapturedAt: TimestampIso | null;
};

export type ImagerySyncFieldIssue = {
  workspaceId: WorkspaceId;
  workspaceName: string | null;
  workspaceSlug: string | null;
  fieldId: string;
  fieldName: string | null;
  lastRequestedAt: TimestampIso | null;
  lastCapturedAt: TimestampIso | null;
  lastProviderKey: ImageryProvider | null;
  lastStatus: ImageryCaptureStatus | null;
  issueType: "missing-imagery" | "stale-imagery" | "unavailable-imagery";
};

export type ImagerySyncReport = {
  generatedAt: TimestampIso;
  createdAfter: TimestampIso | null;
  staleBefore: TimestampIso;
  scannedCaptureCount: number;
  refreshedFieldCount: number;
  materializedFieldCount: number;
  unavailableFieldCount: number;
  staleFieldCount: number;
  workspaceSummaries: readonly ImagerySyncWorkspaceSummary[];
  fieldIssues: readonly ImagerySyncFieldIssue[];
};
