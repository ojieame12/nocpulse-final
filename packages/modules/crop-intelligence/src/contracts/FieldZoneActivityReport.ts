import type { EntityId, JsonValue, TimestampIso, WorkspaceId } from "@fieldpulse/platform-db";
import type {
  IntelligenceFindingFamily,
  IntelligenceSeverity,
  IntelligenceZoneStatus,
} from "./IntelligenceFindingFamily";

export type FieldZoneActivityItem = {
  id: EntityId;
  workspaceId: WorkspaceId;
  fieldId: EntityId;
  family: IntelligenceFindingFamily;
  trackingKey: string;
  latestFindingId: EntityId | null;
  latestRunId: EntityId | null;
  status: IntelligenceZoneStatus;
  latestSeverity: IntelligenceSeverity | null;
  zoneGeoJson: JsonValue;
  affectedCellCount: number;
  affectedCellKeys: readonly string[];
  detectionCount: number;
  firstSeenAt: TimestampIso;
  lastSeenAt: TimestampIso;
  lastStatusChangedAt: TimestampIso;
  metadata: JsonValue;
};

export type FieldZoneActivityFamilySummary = {
  family: IntelligenceFindingFamily;
  totalZoneCount: number;
  newZoneCount: number;
  persistentZoneCount: number;
  recoveringZoneCount: number;
  resolvedZoneCount: number;
};

export type FieldZoneActivityReport = {
  generatedAt: TimestampIso;
  workspaceId: WorkspaceId;
  fieldId: EntityId;
  family?: IntelligenceFindingFamily;
  status?: IntelligenceZoneStatus;
  totalZoneCount: number;
  newZoneCount: number;
  persistentZoneCount: number;
  recoveringZoneCount: number;
  resolvedZoneCount: number;
  familySummaries: readonly FieldZoneActivityFamilySummary[];
  zones: readonly FieldZoneActivityItem[];
};
