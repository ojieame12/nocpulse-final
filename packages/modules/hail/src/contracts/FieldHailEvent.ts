import type {
  Audited,
  EntityId,
  JsonValue,
  TimestampIso,
  WorkspaceScoped,
} from "@fieldpulse/platform-db";
import type {
  HailEventType,
  HailProvider,
  HailSeverity,
} from "./HailProvider";

export type FieldHailEvent = WorkspaceScoped &
  Audited & {
    id: EntityId;
    fieldId: EntityId;
    providerKey: HailProvider;
    sourceKey: string;
    sourceEventKey: string;
    dedupeKey: string;
    eventType: HailEventType;
    severity: HailSeverity;
    reportedAt: TimestampIso;
    windowStart: TimestampIso | null;
    windowEnd: TimestampIso | null;
    headline: string;
    summary: string | null;
    hailSizeMm: number | null;
    coverageGeoJson: JsonValue | null;
    provenance: JsonValue;
  };
