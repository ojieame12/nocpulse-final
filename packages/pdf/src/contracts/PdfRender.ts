export type PdfTextStyle =
  | "title"
  | "heading"
  | "subheading"
  | "body"
  | "caption";

export type PdfTextBlock = {
  style: PdfTextStyle;
  text: string;
};

export type PdfRenderInput = {
  artifactKey: string;
  title: string;
  subject?: string;
  author?: string;
  blocks: readonly PdfTextBlock[];
};

export type PdfRenderResult = {
  artifactKey: string;
  pageCount: number;
  byteSize: number;
  sha256: string;
};

export type PdfBinaryRenderResult = {
  metadata: PdfRenderResult;
  bytes: Uint8Array;
};
