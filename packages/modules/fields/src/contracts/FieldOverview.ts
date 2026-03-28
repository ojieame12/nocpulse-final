import type { TimestampIso } from "@fieldpulse/platform-db";
import type { FieldSummary } from "./FieldSummary";

export type FieldOverview = FieldSummary & {
  latestMoisture: {
    observedAt: TimestampIso;
    rootZonePct: number;
    surfacePct: number;
    confidence: "low" | "medium" | "high";
    sourceKey: string;
  } | null;
};
