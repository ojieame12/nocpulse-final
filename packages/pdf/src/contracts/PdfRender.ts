/* ═══════════════════════════════════════════════════════════════════
   PDF Render Contracts — Block-level layout primitives
   ═══════════════════════════════════════════════════════════════════ */

export type RGB = readonly [number, number, number];

/* ── Text ── */

export type PdfTextStyle =
  | "title"
  | "heading"
  | "subheading"
  | "body"
  | "caption";

export type PdfTextBlock = {
  kind: "text";
  style: PdfTextStyle;
  text: string;
};

/* ── Spacer / Divider ── */

export type PdfSpacerBlock = {
  kind: "spacer";
  height: number;
};

export type PdfDividerBlock = {
  kind: "divider";
  color?: RGB;
  thickness?: number;
  marginTop?: number;
};

/* ── Metric Strip (horizontal row of label/value pairs) ── */

export type PdfMetricStripCell = {
  label: string;
  value: string;
  valueColor?: RGB;
};

export type PdfMetricStripBlock = {
  kind: "metric-strip";
  cells: readonly PdfMetricStripCell[];
  marginTop?: number;
};

/* ── Metric Grid (2-col grid of metric boxes) ── */

export type PdfMetricGridCell = {
  label: string;
  value: string;
  sub?: string;
  valueColor?: RGB;
  accentColor?: RGB;
};

export type PdfMetricGridBlock = {
  kind: "metric-grid";
  cells: readonly PdfMetricGridCell[];
  columns?: 2 | 3 | 4;
  marginTop?: number;
};

/* ── Table ── */

export type PdfTableColumn = {
  label: string;
  width: number; // fraction of content width (0-1)
  align?: "left" | "right" | "center";
};

export type PdfTableRow = {
  cells: readonly string[];
  bold?: boolean;
  accentColor?: RGB;
};

export type PdfTableBlock = {
  kind: "table";
  columns: readonly PdfTableColumn[];
  rows: readonly PdfTableRow[];
  headerBg?: RGB;
  stripeBg?: RGB;
  marginTop?: number;
};

/* ── Progress Bar ── */

export type PdfProgressBarBlock = {
  kind: "progress-bar";
  label: string;
  value: string;
  percent: number; // 0-100
  trackColor?: RGB;
  fillColor?: RGB;
  rangeLabels?: readonly [string, string];
  marginTop?: number;
};

/* ── Severity Card (alert/finding with colored left border) ── */

export type PdfSeverityCardBlock = {
  kind: "severity-card";
  severity: "critical" | "warning" | "info";
  title: string;
  body?: string;
  detail?: string;
  action?: string;
  marginTop?: number;
};

/* ── Status Badge (filled pill with label) ── */

export type PdfStatusBadgeBlock = {
  kind: "status-badge";
  label: string;
  color: RGB;
  textColor?: RGB;
  marginTop?: number;
};

/* ── Sparkline ── */

export type PdfSparklineBlock = {
  kind: "sparkline";
  label: string;
  data: readonly number[];
  color?: RGB;
  height?: number;
  marginTop?: number;
};

export type PdfMultiSparklineSeries = {
  label: string;
  data: readonly number[];
  color?: RGB;
};

export type PdfMultiSparklineBlock = {
  kind: "multi-sparkline";
  label: string;
  series: readonly PdfMultiSparklineSeries[];
  height?: number;
  marginTop?: number;
};

/* ── Key-Value Pairs (compact two-column label: value list) ── */

export type PdfKeyValueBlock = {
  kind: "key-value";
  pairs: readonly { key: string; value: string; valueColor?: RGB }[];
  columns?: 1 | 2;
  marginTop?: number;
};

/* ── Section Header (heading with optional right-aligned meta) ── */

export type PdfSectionHeaderBlock = {
  kind: "section-header";
  label: string;
  meta?: string;
  accentColor?: RGB;
  marginTop?: number;
};

/* ── Brand Assets ── */

export type PdfBrandLogo = {
  format: "png";
  bytes: Uint8Array;
};

/* ── Union of all block types ── */

export type PdfBlock =
  | PdfTextBlock
  | PdfSpacerBlock
  | PdfDividerBlock
  | PdfMetricStripBlock
  | PdfMetricGridBlock
  | PdfTableBlock
  | PdfProgressBarBlock
  | PdfSeverityCardBlock
  | PdfStatusBadgeBlock
  | PdfSparklineBlock
  | PdfMultiSparklineBlock
  | PdfKeyValueBlock
  | PdfSectionHeaderBlock;

/* ── Render input ── */

export type PdfRenderInput = {
  artifactKey: string;
  title: string;
  subject?: string;
  author?: string;
  brandLogo?: PdfBrandLogo;
  blocks: readonly PdfBlock[];
};

/* ── Render results ── */

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
