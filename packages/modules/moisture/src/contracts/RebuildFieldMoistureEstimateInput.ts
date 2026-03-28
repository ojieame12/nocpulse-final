import type { EntityId, TimestampIso, WorkspaceScoped } from "@fieldpulse/platform-db";
import type { MoistureInputProvenance } from "./FieldMoistureSnapshot";

export type RebuildFieldMoistureEstimateInput = WorkspaceScoped & {
  fieldId: EntityId;
  observedAt: TimestampIso;
  sourceKey: string;
  inputs: MoistureInputProvenance;
};
