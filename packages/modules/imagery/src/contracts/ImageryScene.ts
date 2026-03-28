import type { TimestampIso } from "@fieldpulse/platform-db";
import type { ImageryProvider } from "./ImageryProvider";

export type ImageryScene = {
  provider: ImageryProvider;
  sceneKey: string;
  capturedAt: TimestampIso;
  coveragePct: number;
  cloudCoverPct: number | null;
  note?: string;
};
