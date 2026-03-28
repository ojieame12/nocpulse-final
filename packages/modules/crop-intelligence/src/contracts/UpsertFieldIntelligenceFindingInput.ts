import type { JsonValue, TimestampIso, WorkspaceId } from "@fieldpulse/platform-db";
import type { FieldIntelligenceEvidence } from "./FieldIntelligenceEvidence";
import type {
  IntelligenceFindingFamily,
  IntelligenceFindingStatus,
  IntelligenceSeverity,
} from "./IntelligenceFindingFamily";

export type UpsertFieldIntelligenceFindingInput = {
  workspaceId: WorkspaceId;
  fieldId: string;
  runId?: string | null;
  family: IntelligenceFindingFamily;
  severity: IntelligenceSeverity;
  status?: IntelligenceFindingStatus;
  sourceKey: string;
  dedupeKey: string;
  title: string;
  summary?: string | null;
  explanation?: string | null;
  recommendedAction?: string | null;
  confidence?: number | null;
  zoneGeoJson?: JsonValue | null;
  affectedCellKeys?: readonly string[];
  evidence?: FieldIntelligenceEvidence;
  startedAt: TimestampIso;
  endedAt?: TimestampIso | null;
};
