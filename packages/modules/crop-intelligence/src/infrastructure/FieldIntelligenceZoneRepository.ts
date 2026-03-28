import type { FieldIntelligenceZone } from "../contracts/FieldIntelligenceZone";
import type {
  IntelligenceFindingFamily,
  IntelligenceZoneStatus,
} from "../contracts/IntelligenceFindingFamily";
import type { UpsertFieldIntelligenceZoneInput } from "../contracts/UpsertFieldIntelligenceZoneInput";

export type FieldIntelligenceZoneRepository = {
  listByField(input: {
    workspaceId: string;
    fieldId: string;
    family?: IntelligenceFindingFamily;
    trackingKey?: string;
    status?: IntelligenceZoneStatus;
    limit?: number;
  }): Promise<readonly FieldIntelligenceZone[]>;
  listByTrackingKey(input: {
    workspaceId: string;
    fieldId: string;
    family: IntelligenceFindingFamily;
    trackingKey: string;
  }): Promise<readonly FieldIntelligenceZone[]>;
  upsertZone(
    input: UpsertFieldIntelligenceZoneInput,
  ): Promise<FieldIntelligenceZone>;
};
