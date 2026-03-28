import type { FieldZoneActivityFamilySummary, FieldZoneActivityItem, FieldZoneActivityReport } from "../contracts/FieldZoneActivityReport";
import type { FieldIntelligenceZone } from "../contracts/FieldIntelligenceZone";
import type {
  IntelligenceFindingFamily,
  IntelligenceZoneStatus,
} from "../contracts/IntelligenceFindingFamily";

type BuildFieldZoneActivityReportRepository = {
  listByField(input: {
    workspaceId: string;
    fieldId: string;
    family?: IntelligenceFindingFamily;
    trackingKey?: string;
    status?: IntelligenceZoneStatus;
    limit?: number;
  }): Promise<readonly FieldIntelligenceZone[]>;
};

export type BuildFieldZoneActivityReportInput = {
  repository: BuildFieldZoneActivityReportRepository;
  workspaceId: string;
  fieldId: string;
  family?: IntelligenceFindingFamily;
  status?: IntelligenceZoneStatus;
  limit?: number;
  generatedAt?: string;
};

function buildFamilySummary(
  family: IntelligenceFindingFamily,
  zones: readonly FieldIntelligenceZone[],
): FieldZoneActivityFamilySummary {
  return {
    family,
    totalZoneCount: zones.length,
    newZoneCount: zones.filter((zone) => zone.status === "new").length,
    persistentZoneCount: zones.filter((zone) => zone.status === "persistent").length,
    recoveringZoneCount: zones.filter((zone) => zone.status === "recovering").length,
    resolvedZoneCount: zones.filter((zone) => zone.status === "resolved").length,
  };
}

function toActivityItem(zone: FieldIntelligenceZone): FieldZoneActivityItem {
  return {
    id: zone.id,
    workspaceId: zone.workspaceId,
    fieldId: zone.fieldId,
    family: zone.family,
    trackingKey: zone.trackingKey,
    latestFindingId: zone.latestFindingId,
    latestRunId: zone.latestRunId,
    status: zone.status,
    latestSeverity: zone.latestSeverity,
    zoneGeoJson: zone.zoneGeoJson,
    affectedCellCount: zone.affectedCellKeys.length,
    affectedCellKeys: zone.affectedCellKeys,
    detectionCount: zone.detectionCount,
    firstSeenAt: zone.firstSeenAt,
    lastSeenAt: zone.lastSeenAt,
    lastStatusChangedAt: zone.lastStatusChangedAt,
    metadata: zone.metadata,
  };
}

export async function buildFieldZoneActivityReport(
  input: BuildFieldZoneActivityReportInput,
): Promise<FieldZoneActivityReport> {
  const zones = await input.repository.listByField({
    workspaceId: input.workspaceId,
    fieldId: input.fieldId,
    family: input.family,
    status: input.status,
    limit: input.limit,
  });

  const familyKeys = Array.from(new Set(zones.map((zone) => zone.family)));
  const familySummaries = familyKeys.map((family) =>
    buildFamilySummary(
      family,
      zones.filter((zone) => zone.family === family),
    ),
  );

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    workspaceId: input.workspaceId,
    fieldId: input.fieldId,
    family: input.family,
    status: input.status,
    totalZoneCount: zones.length,
    newZoneCount: zones.filter((zone) => zone.status === "new").length,
    persistentZoneCount: zones.filter((zone) => zone.status === "persistent").length,
    recoveringZoneCount: zones.filter((zone) => zone.status === "recovering").length,
    resolvedZoneCount: zones.filter((zone) => zone.status === "resolved").length,
    familySummaries,
    zones: zones.map(toActivityItem),
  };
}
