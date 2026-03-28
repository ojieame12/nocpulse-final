import type { TimestampIso, WorkspaceId } from "@fieldpulse/platform-db";
import type { WeatherProvider } from "./WeatherProvider";

export type WeatherRefreshFieldLabel = {
  workspaceName?: string | null;
  workspaceSlug?: string | null;
  fieldName?: string | null;
};

export type WeatherRefreshWorkspaceSummary = {
  workspaceId: WorkspaceId;
  workspaceName: string | null;
  workspaceSlug: string | null;
  providerKey: WeatherProvider;
  refreshedObservationCount: number;
  refreshedFieldCount: number;
  latestObservedAt: TimestampIso | null;
  latestUpdatedAt: TimestampIso | null;
};

export type WeatherRefreshFieldIssue = {
  workspaceId: WorkspaceId;
  workspaceName: string | null;
  workspaceSlug: string | null;
  fieldId: string;
  fieldName: string | null;
  lastObservedAt: TimestampIso | null;
  lastUpdatedAt: TimestampIso | null;
  ageHours: number | null;
  issueType: "missing-weather" | "stale-weather";
};

export type WeatherRefreshReport = {
  generatedAt: TimestampIso;
  updatedAfter: TimestampIso | null;
  staleBefore: TimestampIso;
  scannedObservationCount: number;
  refreshedFieldCount: number;
  staleFieldCount: number;
  workspaceSummaries: readonly WeatherRefreshWorkspaceSummary[];
  staleFields: readonly WeatherRefreshFieldIssue[];
};
