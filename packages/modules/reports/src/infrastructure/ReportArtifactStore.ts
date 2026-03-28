import type { ReportArtifact } from "../contracts/ReportArtifact";

export type SaveReportArtifactInput = {
  artifact: ReportArtifact;
  bytes: Uint8Array;
  contentType: string;
  cacheControl?: string;
  metadata?: Record<string, string>;
};

export type ReportArtifactStore = {
  save(input: SaveReportArtifactInput): Promise<ReportArtifact>;
};
