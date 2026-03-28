import type {
  EntityId,
  TimestampIso,
  WorkspaceScoped,
} from "@fieldpulse/platform-db";
import type { MoistureEstimate } from "./MoistureEstimate";

export type MoistureInputProvenance = {
  forecastModel?: string;
  radarDataset?: string;
  sarDataset?: string;
  soilDataset?: string;
};

export type FieldMoistureSnapshot = WorkspaceScoped &
  MoistureEstimate & {
    id: EntityId;
    fieldId: EntityId;
    observedAt: TimestampIso;
    sourceKey: string;
    inputs: MoistureInputProvenance;
    createdAt: TimestampIso;
  };
