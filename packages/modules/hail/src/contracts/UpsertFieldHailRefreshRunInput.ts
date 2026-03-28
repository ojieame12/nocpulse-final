import type { JsonValue, TimestampIso, WorkspaceId } from "@fieldpulse/platform-db";
import type { HailProvider } from "./HailProvider";
import type { HailRefreshRunStatus } from "./FieldHailRefreshRun";

export type UpsertFieldHailRefreshRunInput = {
  workspaceId: WorkspaceId;
  fieldId: string;
  providerKey: HailProvider;
  sourceKey: string;
  requestedAt: TimestampIso;
  completedAt?: TimestampIso | null;
  status: HailRefreshRunStatus;
  matchedEventCount: number;
  latestMatchedReportedAt?: TimestampIso | null;
  errorMessage?: string | null;
  provenance?: JsonValue;
};
