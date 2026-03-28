import type { FieldIntelligenceZone } from "../contracts/FieldIntelligenceZone";
import type {
  IntelligenceFindingFamily,
  IntelligenceZoneStatus,
} from "../contracts/IntelligenceFindingFamily";

type ListFieldIntelligenceZonesRepository = {
  listByField(input: {
    workspaceId: string;
    fieldId: string;
    family?: IntelligenceFindingFamily;
    trackingKey?: string;
    status?: IntelligenceZoneStatus;
    limit?: number;
  }): Promise<readonly FieldIntelligenceZone[]>;
};

export type ListFieldIntelligenceZonesInput = {
  repository: ListFieldIntelligenceZonesRepository;
  workspaceId: string;
  fieldId: string;
  family?: IntelligenceFindingFamily;
  trackingKey?: string;
  status?: IntelligenceZoneStatus;
  limit?: number;
};

export async function listFieldIntelligenceZones(
  input: ListFieldIntelligenceZonesInput,
): Promise<readonly FieldIntelligenceZone[]> {
  return input.repository.listByField({
    workspaceId: input.workspaceId,
    fieldId: input.fieldId,
    family: input.family,
    trackingKey: input.trackingKey,
    status: input.status,
    limit: input.limit,
  });
}
