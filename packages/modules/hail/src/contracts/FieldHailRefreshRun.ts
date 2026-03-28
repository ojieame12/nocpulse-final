import type {
  Audited,
  EntityId,
  JsonValue,
  TimestampIso,
  WorkspaceScoped,
} from "@fieldpulse/platform-db";
import type { HailProvider } from "./HailProvider";

export type HailRefreshRunStatus = "completed" | "failed";

export type FieldHailRefreshRun = WorkspaceScoped &
  Audited & {
    id: EntityId;
    fieldId: EntityId;
    providerKey: HailProvider;
    sourceKey: string;
    requestedAt: TimestampIso;
    completedAt: TimestampIso | null;
    status: HailRefreshRunStatus;
    matchedEventCount: number;
    latestMatchedReportedAt: TimestampIso | null;
    errorMessage: string | null;
    provenance: JsonValue;
  };
