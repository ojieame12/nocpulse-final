export type MoistureConfidence = "low" | "medium" | "high";

export type MoistureEstimate = {
  rootZonePct: number;
  surfacePct: number;
  confidence: MoistureConfidence;
};
