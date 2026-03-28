import type { FieldIntelligenceFinding } from "../contracts/FieldIntelligenceFinding";
import type {
  IntelligenceFindingFamily,
  IntelligenceFindingStatus,
} from "../contracts/IntelligenceFindingFamily";
import type { UpsertFieldIntelligenceFindingInput } from "../contracts/UpsertFieldIntelligenceFindingInput";

export type FieldIntelligenceFindingRepository = {
  getById(
    workspaceId: string,
    findingId: string,
  ): Promise<FieldIntelligenceFinding | null>;
  getByDedupeKey(
    workspaceId: string,
    fieldId: string,
    dedupeKey: string,
  ): Promise<FieldIntelligenceFinding | null>;
  listByField(
    workspaceId: string,
    fieldId: string,
    limit?: number,
    status?: IntelligenceFindingStatus,
  ): Promise<readonly FieldIntelligenceFinding[]>;
  listRecentByWorkspace(
    input: {
      workspaceId: string;
      limit?: number;
      status?: IntelligenceFindingStatus;
      family?: IntelligenceFindingFamily;
      updatedAfter?: string;
    },
  ): Promise<readonly FieldIntelligenceFinding[]>;
  upsertFinding(
    input: UpsertFieldIntelligenceFindingInput,
  ): Promise<FieldIntelligenceFinding>;
};
