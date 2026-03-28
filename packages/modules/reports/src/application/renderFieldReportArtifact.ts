import { prepareFieldReportArtifact } from "./prepareFieldReportArtifact";
import type { RenderFieldReportInput } from "../contracts/RenderFieldReportInput";
import type { RenderFieldReportResult } from "../contracts/RenderFieldReportResult";

export function renderFieldReportArtifact(
  input: RenderFieldReportInput,
): RenderFieldReportResult {
  return prepareFieldReportArtifact(input).result;
}
