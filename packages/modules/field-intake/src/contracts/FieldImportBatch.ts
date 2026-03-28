import type { EntityId, TimestampIso, UserId, WorkspaceId } from "@fieldpulse/platform-db";
import type { SpreadsheetImportCandidate, SpreadsheetImportIssue } from "./SpreadsheetImport";

export type FieldImportBatchStatus = "previewed" | "committed";

export type FieldImportCandidateStatus = "pending" | "committed";

export type FieldImportBatch = {
  id: EntityId;
  workspaceId: WorkspaceId;
  sourceType: "spreadsheet";
  fileName: string;
  sheetName: string;
  status: FieldImportBatchStatus;
  rowCount: number;
  validRowCount: number;
  fieldCount: number;
  issueCount: number;
  issues: readonly SpreadsheetImportIssue[];
  createdBy: UserId;
  committedBy: UserId | null;
  committedAt: TimestampIso | null;
  createdAt: TimestampIso;
  updatedAt: TimestampIso;
};

export type FieldImportCandidate = SpreadsheetImportCandidate & {
  batchId: EntityId;
  workspaceId: WorkspaceId;
  ordinal: number;
  status: FieldImportCandidateStatus;
  committedFieldId: EntityId | null;
  commitAction: "created" | "reused" | null;
  committedAt: TimestampIso | null;
  createdAt: TimestampIso;
  updatedAt: TimestampIso;
};
