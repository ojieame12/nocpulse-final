import type { JsonValue, TimestampIso, WorkspaceId } from "@fieldpulse/platform-db";
import type { CropIntelligenceRunStatus } from "./IntelligenceFindingFamily";

export type UpsertCropIntelligenceRunInput = {
  workspaceId: WorkspaceId;
  fieldId: string;
  sourceKey: string;
  modelKey: string;
  status: CropIntelligenceRunStatus;
  startedAt: TimestampIso;
  completedAt?: TimestampIso | null;
  inputVersion?: string | null;
  provenance?: JsonValue;
};
