import type { ReportArtifact } from "../contracts/ReportArtifact";

export function describeReportArtifact(artifact: ReportArtifact) {
  return `Report ${artifact.id} for field ${artifact.fieldId}: ${artifact.url} (${artifact.storageMode})`;
}
