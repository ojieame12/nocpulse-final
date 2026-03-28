export interface FieldActivityFindingItem {
  id: string;
  title: string;
  summary: string | null;
  severity: "low" | "medium" | "high" | "critical";
  startedAt: string;
  trackedZoneIds: readonly string[];
}

export interface FieldActivityZoneItem {
  id: string;
  family: string;
  trackingKey: string;
  status: string;
  severity: "low" | "medium" | "high" | "critical" | null;
  affectedCellCount: number;
  detectionCount: number;
  lastSeenAt: string;
}

export interface FieldActivityFamilySummary {
  family: string;
  activeZoneCount: number;
  totalZoneCount: number;
}

export interface FieldActivityPanelModel {
  generatedAt: string;
  activeFindingCount: number;
  activeZoneCount: number;
  newZoneCount: number;
  recoveringZoneCount: number;
  resolvedZoneCount: number;
  familySummaries: readonly FieldActivityFamilySummary[];
  findings: readonly FieldActivityFindingItem[];
  zones: readonly FieldActivityZoneItem[];
}
