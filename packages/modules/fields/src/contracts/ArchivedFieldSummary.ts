import type { FieldSummary } from "./FieldSummary";

export type ArchivedFieldSummary = FieldSummary & {
  archivedAt: string;
  archivedBy: string | null;
};
