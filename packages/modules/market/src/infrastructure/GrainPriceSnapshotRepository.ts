import type { GrainPriceSnapshot } from "../contracts/GrainPriceSnapshot";
import type { UpsertGrainPriceSnapshotInput } from "../contracts/UpsertGrainPriceSnapshotInput";

export type GrainPriceSnapshotRepository = {
  latest(cropSymbol: string): Promise<GrainPriceSnapshot | null>;
  recent(cropSymbol: string, limit: number): Promise<readonly GrainPriceSnapshot[]>;
  upsert(input: UpsertGrainPriceSnapshotInput): Promise<GrainPriceSnapshot>;
};
