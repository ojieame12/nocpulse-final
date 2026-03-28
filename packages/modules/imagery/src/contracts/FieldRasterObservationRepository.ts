import type { EntityId, TimestampIso, WorkspaceId } from "@fieldpulse/platform-db";
import type {
  FieldRasterObservation,
  ReplaceFieldRasterObservationInput,
} from "./FieldRasterObservation";

export type FieldRasterObservationRepository = {
  getLatestByField(
    workspaceId: WorkspaceId,
    fieldId: EntityId,
    observedAt?: TimestampIso,
  ): Promise<FieldRasterObservation | null>;
  getLatestByFieldAndProvider(
    workspaceId: WorkspaceId,
    fieldId: EntityId,
    providerKey: string,
    observedAt?: TimestampIso,
  ): Promise<FieldRasterObservation | null>;
  replaceObservation(
    input: ReplaceFieldRasterObservationInput,
  ): Promise<FieldRasterObservation>;
};
