import type { EntityId, WorkspaceId } from "@fieldpulse/platform-db";
import type { FieldWeatherDerivedSignalSet } from "../contracts/FieldWeatherDerivedSignalSet";
import type { UpsertFieldWeatherDerivedSignalSetInput } from "../contracts/UpsertFieldWeatherDerivedSignalSetInput";

export type FieldWeatherDerivedSignalSetRepository = {
  getLatestByField(
    workspaceId: WorkspaceId,
    fieldId: EntityId,
  ): Promise<FieldWeatherDerivedSignalSet | null>;
  upsertSignalSet(
    input: UpsertFieldWeatherDerivedSignalSetInput,
  ): Promise<FieldWeatherDerivedSignalSet>;
};
