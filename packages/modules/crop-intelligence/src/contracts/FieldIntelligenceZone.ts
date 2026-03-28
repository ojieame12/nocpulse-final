import type {
  Audited,
  EntityId,
  JsonValue,
  TimestampIso,
  WorkspaceScoped,
} from "@fieldpulse/platform-db";
import type {
  IntelligenceFindingFamily,
  IntelligenceSeverity,
  IntelligenceZoneStatus,
} from "./IntelligenceFindingFamily";

export type FieldIntelligenceZone = WorkspaceScoped &
  Audited & {
    id: EntityId;
    fieldId: EntityId;
    family: IntelligenceFindingFamily;
    trackingKey: string;
    latestFindingId: EntityId | null;
    latestRunId: EntityId | null;
    status: IntelligenceZoneStatus;
    latestSeverity: IntelligenceSeverity | null;
    zoneGeoJson: JsonValue;
    affectedCellKeys: readonly string[];
    detectionCount: number;
    firstSeenAt: TimestampIso;
    lastSeenAt: TimestampIso;
    lastStatusChangedAt: TimestampIso;
    metadata: JsonValue;
  };
