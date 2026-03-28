import type { PdfRenderResult } from "../contracts/PdfRender";

export function describePdfRenderResult(input: PdfRenderResult) {
  return `${input.artifactKey} (${input.pageCount} pages, ${input.byteSize} bytes)`;
}
