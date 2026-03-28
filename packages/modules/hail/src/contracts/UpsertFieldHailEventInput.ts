import type { JsonValue, TimestampIso, WorkspaceId } from "@fieldpulse/platform-db";
import type {
  HailEventType,
  HailProvider,
  HailSeverity,
} from "./HailProvider";

export type UpsertFieldHailEventInput = {
  workspaceId: WorkspaceId;
  fieldId: string;
  providerKey: HailProvider;
  sourceKey: string;
  sourceEventKey: string;
  dedupeKey: string;
  eventType: HailEventType;
  severity: HailSeverity;
  reportedAt: TimestampIso;
  windowStart?: TimestampIso | null;
  windowEnd?: TimestampIso | null;
  headline: string;
  summary?: string | null;
  hailSizeMm?: number | null;
  coverageGeoJson?: JsonValue | null;
  provenance?: JsonValue;
};
