import type { EntityId, WorkspaceId } from "@fieldpulse/platform-db";
import type { FieldWeatherObservation } from "../contracts/FieldWeatherObservation";
import type { UpsertFieldWeatherObservationInput } from "../contracts/UpsertFieldWeatherObservationInput";

export type FieldWeatherObservationRepository = {
  getLatestByField(
    workspaceId: WorkspaceId,
    fieldId: EntityId,
  ): Promise<FieldWeatherObservation | null>;
  listLatestByWorkspace(
    workspaceId: WorkspaceId,
  ): Promise<readonly FieldWeatherObservation[]>;
  listRecentObservations(input: {
    workspaceId?: WorkspaceId;
    updatedAfter?: string;
    limit?: number;
  }): Promise<readonly FieldWeatherObservation[]>;
  listRecentByField(
    workspaceId: WorkspaceId,
    fieldId: EntityId,
    limit?: number,
  ): Promise<readonly FieldWeatherObservation[]>;
  upsertObservation(
    input: UpsertFieldWeatherObservationInput,
  ): Promise<FieldWeatherObservation>;
};
