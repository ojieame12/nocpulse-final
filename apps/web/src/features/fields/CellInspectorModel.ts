export interface FieldCellInspectorCell {
  id: string;
  rowIndex: number;
  columnIndex: number;
  observedAt: string;
  sourceKey: string;
  rootZonePct: number;
  surfacePct: number;
  confidence: "low" | "medium" | "high";
}

export interface FieldCellInspectorFinding {
  id: string;
  family: string;
  severity: "low" | "medium" | "high" | "critical";
  status: string;
  title: string;
  summary: string | null;
  recommendedAction: string | null;
  startedAt: string;
  affectedCellKeys: readonly string[];
  trackedZoneIds: readonly string[];
}

export interface FieldCellInspectorZone {
  id: string;
  family: string;
  trackingKey: string;
  status: string;
  latestSeverity: "low" | "medium" | "high" | "critical" | null;
  affectedCellKeys: readonly string[];
  detectionCount: number;
  lastSeenAt: string;
}

export interface FieldCellInspectorModel {
  cells: readonly FieldCellInspectorCell[];
  findings: readonly FieldCellInspectorFinding[];
  zones: readonly FieldCellInspectorZone[];
}
