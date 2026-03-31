import type { CropIntelligenceRun } from "../contracts/CropIntelligenceRun";
import type { CropIntelligenceRunStatus } from "../contracts/IntelligenceFindingFamily";
import type { UpsertCropIntelligenceRunInput } from "../contracts/UpsertCropIntelligenceRunInput";

export type CropIntelligenceRunRepository = {
  listLatestByWorkspace(
    workspaceId: string,
    sourceKey?: string,
  ): Promise<readonly CropIntelligenceRun[]>;
  listRecentRuns(input: {
    workspaceId?: string;
    fieldId?: string;
    startedAfter?: string;
    limit?: number;
    sourceKey?: string;
    status?: CropIntelligenceRunStatus;
  }): Promise<readonly CropIntelligenceRun[]>;
  upsertRun(input: UpsertCropIntelligenceRunInput): Promise<CropIntelligenceRun>;
};
