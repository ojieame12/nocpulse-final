import type { FieldMoistureSnapshot } from "./FieldMoistureSnapshot";

export type RebuildFieldMoistureEstimateResult = {
  snapshot: FieldMoistureSnapshot;
  action: "created" | "reused";
};
