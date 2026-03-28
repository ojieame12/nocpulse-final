import type { JsonValue, TimestampIso, WorkspaceId } from "@fieldpulse/platform-db";
import type {
  IntelligenceFindingFamily,
  IntelligenceSeverity,
  IntelligenceZoneStatus,
} from "./IntelligenceFindingFamily";

export type UpsertFieldIntelligenceZoneInput = {
  id?: string;
  workspaceId: WorkspaceId;
  fieldId: string;
  family: IntelligenceFindingFamily;
  trackingKey: string;
  latestFindingId?: string | null;
  latestRunId?: string | null;
  status: IntelligenceZoneStatus;
  latestSeverity?: IntelligenceSeverity | null;
  zoneGeoJson: JsonValue;
  affectedCellKeys: readonly string[];
  detectionCount: number;
  firstSeenAt: TimestampIso;
  lastSeenAt: TimestampIso;
  lastStatusChangedAt: TimestampIso;
  metadata?: JsonValue;
};
