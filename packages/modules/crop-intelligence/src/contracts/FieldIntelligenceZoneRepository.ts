import type { FieldIntelligenceZone } from "./FieldIntelligenceZone";
import type {
  IntelligenceFindingFamily,
  IntelligenceZoneStatus,
} from "./IntelligenceFindingFamily";
import type { UpsertFieldIntelligenceZoneInput } from "./UpsertFieldIntelligenceZoneInput";

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
