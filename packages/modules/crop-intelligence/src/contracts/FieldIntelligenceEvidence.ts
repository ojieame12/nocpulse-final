import type { EntityId, JsonValue, TimestampIso } from "@fieldpulse/platform-db";
import type {
  IntelligenceSeverity,
  IntelligenceZoneStatus,
} from "./IntelligenceFindingFamily";

export type FieldIntelligenceTrackedZoneReference = {
  zoneId: EntityId;
  trackingKey: string;
  status: IntelligenceZoneStatus;
  severity: IntelligenceSeverity | null;
  detectionCount: number;
  affectedCellCount: number;
  firstSeenAt: TimestampIso;
  lastSeenAt: TimestampIso;
  lastStatusChangedAt: TimestampIso;
  metadata?: JsonValue;
};

export type FieldIntelligenceEvidence = {
  captureId?: string;
  rasterObservationId?: string;
  moistureSnapshotId?: string;
  weatherObservationId?: string;
  weatherSignalSetId?: string;
  hailEventId?: string;
  affectedCellKeys?: readonly string[];
  datasetVersion?: string;
  providerKeys?: readonly string[];
  trackedZones?: readonly FieldIntelligenceTrackedZoneReference[];
  metadata?: JsonValue;
};
