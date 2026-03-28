import type { FieldIntelligenceTrackedZoneReference } from "../../contracts/FieldIntelligenceEvidence";
import type { FieldIntelligenceZone } from "../../contracts/FieldIntelligenceZone";

export function buildTrackedZoneReferences(
  zones: readonly FieldIntelligenceZone[],
): readonly FieldIntelligenceTrackedZoneReference[] {
  return zones.map((zone) => ({
    zoneId: zone.id,
    trackingKey: zone.trackingKey,
    status: zone.status,
    severity: zone.latestSeverity,
    detectionCount: zone.detectionCount,
    affectedCellCount: zone.affectedCellKeys.length,
    firstSeenAt: zone.firstSeenAt,
    lastSeenAt: zone.lastSeenAt,
    lastStatusChangedAt: zone.lastStatusChangedAt,
    metadata: zone.metadata,
  }));
}
