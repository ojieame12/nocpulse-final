import type { WorkspaceScoped } from "@fieldpulse/platform-db";
import type { FieldBoundary } from "./FieldBoundary";

export type CreateFieldInput = WorkspaceScoped & {
  name: string;
  areaHa: number;
  legalLandDescription?: string | null;
  boundary: FieldBoundary;
};
