import { renderPdfDocument } from "@fieldpulse/pdf";
import { buildFieldReportPdfRenderInput } from "./buildFieldReportPdfRenderInput";
import { formatReportDateStamp } from "./reportFormat";
import { slugifyReportSegment } from "./reportSlug";
import type { RenderFieldReportInput } from "../contracts/RenderFieldReportInput";
import type { RenderFieldReportResult } from "../contracts/RenderFieldReportResult";

export type PreparedFieldReportArtifact = {
  result: RenderFieldReportResult;
  bytes: Uint8Array;
  contentType: "application/pdf";
  cacheControl: string;
};

export function prepareFieldReportArtifact(
  input: RenderFieldReportInput,
): PreparedFieldReportArtifact {
  const { readModel } = input;
  const reportDate = formatReportDateStamp(readModel.reportDate);
  const fieldSlug = slugifyReportSegment(readModel.field.name);
  const artifactId = `${readModel.field.id}:${reportDate}`;
  const artifactKey = `reports/${readModel.field.workspaceId}/${fieldSlug}/${reportDate}.pdf`;
  const pdfDocument = renderPdfDocument(
    buildFieldReportPdfRenderInput({
      artifactKey,
      readModel,
      brandLogo: input.brandLogoPngBytes ? { format: "png", bytes: input.brandLogoPngBytes } : undefined,
    }),
  );
  const activeAlertSummary =
    readModel.summary.activeAlertCount == null
      ? "alert data unavailable"
      : `${readModel.summary.activeAlertCount} active alerts`;

  return {
    bytes: pdfDocument.bytes,
    contentType: "application/pdf",
    cacheControl: "private, max-age=0, no-cache",
    result: {
      artifact: {
        id: artifactId,
        fieldId: readModel.field.id,
        artifactKey,
        url: `r2://pending/${artifactKey}`,
        storageMode: "ephemeral",
      },
      document: pdfDocument.metadata,
      status: input.dryRun ? "dry-run" : "rendered",
      note: `Report ${input.dryRun ? "prepared" : "rendered"} for ${readModel.field.name} with ${activeAlertSummary}, ${readModel.summary.activeFindingCount} active findings, and ${readModel.summary.trackedZoneCount} tracked zones. PDF bytes were generated in memory; artifact persistence is not configured yet.`,
      summary: {
        fieldId: readModel.field.id,
        fieldName: readModel.field.name,
        reportDate: readModel.reportDate,
        activeAlertCount: readModel.summary.activeAlertCount,
        activeFindingCount: readModel.summary.activeFindingCount,
        trackedZoneCount: readModel.summary.trackedZoneCount,
      },
    },
  };
}
