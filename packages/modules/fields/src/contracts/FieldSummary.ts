import type { EntityId, WorkspaceScoped } from "@fieldpulse/platform-db";

export type FieldSummary = WorkspaceScoped & {
  id: EntityId;
  name: string;
  areaHa: number;
  legalLandDescription: string | null;
};
