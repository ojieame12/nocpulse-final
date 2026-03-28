import type { MoistureEstimate } from "../contracts/MoistureEstimate";

export function describeMoistureEstimate(input: MoistureEstimate) {
  return `Root zone ${input.rootZonePct.toFixed(1)}%, surface ${input.surfacePct.toFixed(1)}%, confidence ${input.confidence}.`;
}
