import type { MoistureEstimate } from "../../contracts/MoistureEstimate";

export function isReliableMoistureEstimate(input: MoistureEstimate) {
  return input.confidence === "high" || input.confidence === "medium";
}
