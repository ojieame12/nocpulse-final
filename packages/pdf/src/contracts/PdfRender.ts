/* ── Text styles ── */

export type PdfTextStyle =
  | "title"
  | "heading"
  | "subheading"
  | "body"
  | "caption";

/* ── Block types ──
   The renderer accepts a flat array of blocks. Each block is a discriminated
   union keyed by `type`. The legacy shape { style, text } still works and is
   treated as a "text" block internally.                                     */

/** Simple styled text paragraph. */
export type PdfTextBlock = {
  type?: "text";
  style: PdfTextStyle;
  text: string;
};

/** Horizontal divider line. */
export type PdfDividerBlock = {
  type: "divider";
  /** Weight in points (default 0.5). */
  weight?: number;
  /** RGB triplet 0–1. Defaults to a light gray. */
  color?: readonly [number, number, number];
};

/** Vertical whitespace. */
export type PdfSpacerBlock = {
  type: "spacer";
  /** Height in points (default 8). */
  height?: number;
};

/** Label + value pair rendered as two columns. */
export type PdfKeyValueBlock = {
  type: "key-value";
  label: string;
  value: string;
  /** Optional right-aligned suffix (e.g. a unit). */
  suffix?: string;
};

/** Row of label + value pairs (for compact metric displays). */
export type PdfMetricRowBlock = {
  type: "metric-row";
  items: readonly { label: string; value: string }[];
};

/** Colored status badge rendered inline after a label. */
export type PdfStatusBlock = {
  type: "status";
  label: string;
  status: string;
  /** Semantic intent — drives fill color. */
  intent: "positive" | "warning" | "danger" | "info" | "neutral";
};

/** All renderable block types. */
export type PdfBlock =
  | PdfTextBlock
  | PdfDividerBlock
  | PdfSpacerBlock
  | PdfKeyValueBlock
  | PdfMetricRowBlock
  | PdfStatusBlock;

/* ── Render I/O ── */

export type PdfRenderInput = {
  artifactKey: string;
  title: string;
  subject?: string;
  author?: string;
  /** Accepts both legacy PdfTextBlock[] and new PdfBlock[]. */
  blocks: readonly PdfBlock[];
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
