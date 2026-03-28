import type {
  Audited,
  EntityId,
  JsonValue,
  TimestampIso,
  WorkspaceScoped,
} from "@fieldpulse/platform-db";
import type { CropIntelligenceRunStatus } from "./IntelligenceFindingFamily";

export type CropIntelligenceRun = WorkspaceScoped &
  Audited & {
    id: EntityId;
    fieldId: EntityId;
    sourceKey: string;
    modelKey: string;
    status: CropIntelligenceRunStatus;
    startedAt: TimestampIso;
    completedAt: TimestampIso | null;
    inputVersion: string | null;
    provenance: JsonValue;
  };
