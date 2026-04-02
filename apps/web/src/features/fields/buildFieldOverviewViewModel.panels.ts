import type { FieldNotesProps } from "../../components/panels/NotesTab";
import type {
  FieldActivityFamilySummary,
  FieldActivityFindingItem,
  FieldActivityPanelModel,
  FieldActivityZoneItem,
} from "./FieldActivityPanelModel";
import { filterFieldQualityDependentAlertRecords } from "./buildFieldOverviewViewModel.shared";

function formatCoordinateLabel(point: readonly [number, number] | null | undefined) {
  if (!point) {
    return "No mapped coordinate";
  }

  const [longitude, latitude] = point;
  const latitudeHemisphere = latitude >= 0 ? "N" : "S";
  const longitudeHemisphere = longitude >= 0 ? "E" : "W";
  return `${Math.abs(latitude).toFixed(4)}°${latitudeHemisphere}, ${Math.abs(longitude).toFixed(4)}°${longitudeHemisphere}`;
}

function severityRank(value: string | null | undefined) {
  switch (value) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
}

export function buildNotesProps(
  rm: any,
  workspaceId: string,
  fieldId: string,
  fieldName: string,
  notes: readonly {
    id: string;
    findingId: string | null;
    zoneId: string | null;
    cellKey: string | null;
    observedAt: string;
    noteText: string;
    outcome: "confirmed" | "not_confirmed" | "resolved" | "monitor";
  }[],
): FieldNotesProps {
  const activeFindings = [...(rm.findings ?? [])]
    .filter((finding: any) => finding.status === "active")
    .sort((left: any, right: any) => severityRank(right.severity) - severityRank(left.severity));
  const primaryFinding = activeFindings[0] ?? null;
  const primaryZoneId =
    primaryFinding?.evidence?.trackedZones?.[0]?.zoneId ??
    null;
  const primaryZone =
    primaryZoneId != null
      ? (rm.zones?.zones ?? []).find((zone: any) => zone.id === primaryZoneId) ?? null
      : null;
  const primaryCellKey =
    primaryFinding?.affectedCellKeys?.[0] ??
    primaryZone?.affectedCellKeys?.[0] ??
    null;
  const primaryCell =
    primaryCellKey != null
      ? (rm.moisture?.latestCells ?? []).find((cell: any) => cell.cellKey === primaryCellKey) ?? null
      : null;

  return {
    workspaceId,
    fieldId,
    name: fieldName,
    lld: rm.intake?.legalLandDescription ?? "No legal land description",
    inspectionTarget: primaryFinding
      ? {
          dateLabel: new Date(primaryFinding.startedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
          name: primaryZone
            ? `${primaryZone.family.replace(/_/g, " ")} · ${primaryZone.trackingKey}`
            : primaryFinding.title,
          coordinateLabel: formatCoordinateLabel(primaryCell?.centroid),
          findingId: primaryFinding.id,
          zoneId: primaryZoneId,
          cellKey: primaryCellKey,
        }
      : null,
    entries: notes.map((note) => ({
      id: note.id,
      date: note.observedAt,
      text: note.noteText,
      status: note.outcome,
      findingId: note.findingId,
      zoneId: note.zoneId,
      cellKey: note.cellKey,
    })),
    submitUrl: `/api/fields/${fieldId}/notes`,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildActivityPanelModel(rm: any): FieldActivityPanelModel {
  const dataQualityLabel = rm.summary?.dataQuality?.label ?? null;
  const rawFindings = rm.findings ?? [];
  const rawZones = rm.zones?.zones ?? [];
  const rawFamilySummaries = rm.zones?.familySummaries ?? [];
  const presentedFindings = filterFieldQualityDependentAlertRecords(
    rawFindings,
    dataQualityLabel,
  );
  const presentedZones = filterFieldQualityDependentAlertRecords(
    rawZones,
    dataQualityLabel,
  );
  const presentedFamilySummaries = filterFieldQualityDependentAlertRecords(
    rawFamilySummaries,
    dataQualityLabel,
  );
  const hiddenFindingCount = rawFindings.length - presentedFindings.length;
  const hiddenZoneCount = rawZones.length - presentedZones.length;
  const activeFindingCount = presentedFindings.filter(
    (finding: any) => finding.status === "active",
  ).length;
  const activeZoneCount = presentedZones.filter(
    (zone: any) => zone.status !== "resolved",
  ).length;
  const newZoneCount = presentedZones.filter((zone: any) => zone.status === "new").length;
  const recoveringZoneCount = presentedZones.filter(
    (zone: any) => zone.status === "recovering",
  ).length;
  const resolvedZoneCount = presentedZones.filter(
    (zone: any) => zone.status === "resolved",
  ).length;

  const findings: FieldActivityFindingItem[] = presentedFindings.map((finding: any) => ({
    id: finding.id,
    title: finding.title,
    summary: finding.summary,
    severity: finding.severity,
    startedAt: finding.startedAt,
    trackedZoneIds:
      finding.evidence?.trackedZones
        ?.map((zone: any) => zone.zoneId)
        .filter((zoneId: unknown) => typeof zoneId === "string") ?? [],
  }));

  const zones: FieldActivityZoneItem[] = presentedZones.map((zone: any) => ({
    id: zone.id,
    family: zone.family,
    trackingKey: zone.trackingKey,
    status: zone.status,
    severity: zone.latestSeverity,
    affectedCellCount: zone.affectedCellCount,
    detectionCount: zone.detectionCount,
    lastSeenAt: zone.lastSeenAt,
  }));

  const familySummaries: FieldActivityFamilySummary[] = presentedFamilySummaries.map(
    (summary: any) => ({
      family: summary.family,
      activeZoneCount:
        (summary.newZoneCount ?? 0) +
        (summary.persistentZoneCount ?? 0) +
        (summary.recoveringZoneCount ?? 0),
      totalZoneCount: summary.totalZoneCount ?? 0,
    }),
  );

  return {
    generatedAt: rm.generatedAt,
    dataQualityLabel,
    activeFindingCount,
    activeZoneCount,
    newZoneCount,
    recoveringZoneCount,
    resolvedZoneCount,
    hiddenFindingCount,
    hiddenZoneCount,
    familySummaries,
    findings,
    zones,
  };
}
