import type { EntityId, WorkspaceId } from "@fieldpulse/platform-db";
import type { FieldWeatherDerivedSignalSet } from "../contracts/FieldWeatherDerivedSignalSet";
import type { UpsertFieldWeatherDerivedSignalSetInput } from "../contracts/UpsertFieldWeatherDerivedSignalSetInput";

export type FieldWeatherDerivedSignalSetRepository = {
  getLatestByField(
    workspaceId: WorkspaceId,
    fieldId: EntityId,
  ): Promise<FieldWeatherDerivedSignalSet | null>;
  listRecentByField(
    workspaceId: WorkspaceId,
    fieldId: EntityId,
    limit?: number,
  ): Promise<readonly FieldWeatherDerivedSignalSet[]>;
  upsertSignalSet(
    input: UpsertFieldWeatherDerivedSignalSetInput,
  ): Promise<FieldWeatherDerivedSignalSet>;
};
