import type { TimestampIso, WorkspaceId } from "@fieldpulse/platform-db";
import type { HailProvider } from "./HailProvider";
import type { HailRefreshRunStatus } from "./FieldHailRefreshRun";

export type HailRefreshFieldLabel = {
  workspaceName?: string | null;
  workspaceSlug?: string | null;
  fieldName?: string | null;
};

export type HailRefreshWorkspaceSummary = {
  workspaceId: WorkspaceId;
  workspaceName: string | null;
  workspaceSlug: string | null;
  providerKey: HailProvider;
  refreshedFieldCount: number;
  matchedFieldCount: number;
  noSignalFieldCount: number;
  matchedEventCount: number;
  latestRequestedAt: TimestampIso | null;
  latestCompletedAt: TimestampIso | null;
};

export type HailRefreshMatchedField = {
  workspaceId: WorkspaceId;
  workspaceName: string | null;
  workspaceSlug: string | null;
  fieldId: string;
  fieldName: string | null;
  providerKey: HailProvider;
  requestedAt: TimestampIso;
  completedAt: TimestampIso | null;
  matchedEventCount: number;
  latestMatchedReportedAt: TimestampIso | null;
};

export type HailRefreshNoSignalField = {
  workspaceId: WorkspaceId;
  workspaceName: string | null;
  workspaceSlug: string | null;
  fieldId: string;
  fieldName: string | null;
  providerKey: HailProvider;
  requestedAt: TimestampIso;
  completedAt: TimestampIso | null;
};

export type HailRefreshFieldIssue = {
  workspaceId: WorkspaceId;
  workspaceName: string | null;
  workspaceSlug: string | null;
  fieldId: string;
  fieldName: string | null;
  lastRequestedAt: TimestampIso | null;
  lastCompletedAt: TimestampIso | null;
  ageHours: number | null;
  lastStatus: HailRefreshRunStatus | null;
  lastMatchedEventCount: number | null;
  lastErrorMessage: string | null;
  issueType:
    | "missing-hail-refresh"
    | "stale-hail-refresh"
    | "failed-hail-refresh";
};

export type HailRefreshReport = {
  generatedAt: TimestampIso;
  requestedAfter: TimestampIso | null;
  staleBefore: TimestampIso;
  scannedRunCount: number;
  refreshedFieldCount: number;
  matchedFieldCount: number;
  noSignalFieldCount: number;
  staleFieldCount: number;
  workspaceSummaries: readonly HailRefreshWorkspaceSummary[];
  matchedFields: readonly HailRefreshMatchedField[];
  noSignalFields: readonly HailRefreshNoSignalField[];
  staleFields: readonly HailRefreshFieldIssue[];
};
