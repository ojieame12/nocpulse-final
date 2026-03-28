import type {
  Audited,
  EntityId,
  JsonValue,
  TimestampIso,
  WorkspaceScoped,
} from "@fieldpulse/platform-db";
import type { FieldIntelligenceEvidence } from "./FieldIntelligenceEvidence";
import type {
  IntelligenceFindingFamily,
  IntelligenceFindingStatus,
  IntelligenceSeverity,
} from "./IntelligenceFindingFamily";

export type FieldIntelligenceFinding = WorkspaceScoped &
  Audited & {
    id: EntityId;
    fieldId: EntityId;
    runId: EntityId | null;
    family: IntelligenceFindingFamily;
    severity: IntelligenceSeverity;
    status: IntelligenceFindingStatus;
    sourceKey: string;
    dedupeKey: string;
    title: string;
    summary: string | null;
    explanation: string | null;
    recommendedAction: string | null;
    confidence: number | null;
    zoneGeoJson: JsonValue | null;
    affectedCellKeys: readonly string[];
    evidence: FieldIntelligenceEvidence;
    startedAt: TimestampIso;
    endedAt: TimestampIso | null;
  };
