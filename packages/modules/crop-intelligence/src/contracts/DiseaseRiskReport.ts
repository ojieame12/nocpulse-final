import type { TimestampIso, WorkspaceId } from "@fieldpulse/platform-db";
import type {
  CropIntelligenceRunStatus,
  IntelligenceSeverity,
} from "./IntelligenceFindingFamily";

export type DiseaseRiskFieldLabel = {
  workspaceName?: string | null;
  workspaceSlug?: string | null;
  fieldName?: string | null;
};

export type DiseaseRiskWorkspaceSummary = {
  workspaceId: WorkspaceId;
  workspaceName: string | null;
  workspaceSlug: string | null;
  activeFindingCount: number;
  activeFieldCount: number;
  refreshedFieldCount: number;
  noSignalFieldCount: number;
  latestRunStartedAt: TimestampIso | null;
  latestRunCompletedAt: TimestampIso | null;
};

export type ActiveDiseaseRiskField = {
  workspaceId: WorkspaceId;
  workspaceName: string | null;
  workspaceSlug: string | null;
  fieldId: string;
  fieldName: string | null;
  severity: IntelligenceSeverity;
  title: string;
  confidence: number | null;
  startedAt: TimestampIso;
  updatedAt: TimestampIso;
  diseaseModelKey: string | null;
};

export type DiseaseRiskNoSignalField = {
  workspaceId: WorkspaceId;
  workspaceName: string | null;
  workspaceSlug: string | null;
  fieldId: string;
  fieldName: string | null;
  latestRunStartedAt: TimestampIso;
  latestRunCompletedAt: TimestampIso | null;
};

export type DiseaseRiskFieldIssue = {
  workspaceId: WorkspaceId;
  workspaceName: string | null;
  workspaceSlug: string | null;
  fieldId: string;
  fieldName: string | null;
  lastRunStartedAt: TimestampIso | null;
  lastRunCompletedAt: TimestampIso | null;
  ageHours: number | null;
  lastRunStatus: CropIntelligenceRunStatus | null;
  issueType:
    | "missing-disease-eval"
    | "stale-disease-eval"
    | "failed-disease-eval";
};

export type DiseaseRiskReport = {
  generatedAt: TimestampIso;
  startedAfter: TimestampIso | null;
  staleBefore: TimestampIso;
  scannedRunCount: number;
  refreshedFieldCount: number;
  activeFindingCount: number;
  activeFieldCount: number;
  noSignalFieldCount: number;
  staleFieldCount: number;
  workspaceSummaries: readonly DiseaseRiskWorkspaceSummary[];
  activeFields: readonly ActiveDiseaseRiskField[];
  noSignalFields: readonly DiseaseRiskNoSignalField[];
  staleFields: readonly DiseaseRiskFieldIssue[];
};
