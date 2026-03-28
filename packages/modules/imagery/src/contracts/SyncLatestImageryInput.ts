import type { EntityId, TimestampIso, WorkspaceScoped } from "@fieldpulse/platform-db";
import type { ImageryProvider } from "./ImageryProvider";

export type SyncLatestImageryInput = WorkspaceScoped & {
  fieldId: EntityId;
  requestedAt: TimestampIso;
  providers?: readonly ImageryProvider[];
  dryRun?: boolean;
};
