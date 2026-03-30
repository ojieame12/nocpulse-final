import type { PdfRenderResult } from "@fieldpulse/pdf";
import type { ReportArtifact } from "./ReportArtifact";

export type RenderFieldReportResult = {
  artifact: ReportArtifact;
  document: PdfRenderResult;
  status: "rendered" | "dry-run";
  note: string;
  summary: {
    fieldId: string;
    fieldName: string;
    reportDate: string;
    activeAlertCount: number | null;
    activeFindingCount: number;
    trackedZoneCount: number;
  };
};
