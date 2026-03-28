import type { EntityId, TimestampIso, WorkspaceScoped } from "@fieldpulse/platform-db";
import type { MoistureConfidence } from "./MoistureEstimate";
import type { MoistureInputProvenance } from "./FieldMoistureSnapshot";

export type UpsertFieldMoistureSnapshotInput = WorkspaceScoped & {
  fieldId: EntityId;
  observedAt: TimestampIso;
  sourceKey: string;
  rootZonePct: number;
  surfacePct: number;
  confidence: MoistureConfidence;
  inputs: MoistureInputProvenance;
};
