/* ═══════════════════════════════════════════════════════════════════
   NocPulse PDF Style Sheet — single source of truth
   ═══════════════════════════════════════════════════════════════════

   Typography rules:
   1.  Two typefaces only: sans (Helvetica/Sintony stand-in) and mono
       (Courier/IBM Plex Mono stand-in). Serif is removed from the
       report — Caudex/P22 Mackinac is a display face that belongs on
       the landing page hero, not in a dense data document.
   2.  Four font sizes on a strict scale: 18 → 11 → 9.5 → 8
   3.  Two weights: Regular (F1) and Bold (F2). Mono for data (F5).
   4.  Three text colors: primary, secondary, muted.
   5.  Spacing based on a 12pt unit: 12, 24, 36, 48.

   Color rules:
   - Status colors (red/amber/green) appear ONLY on severity badges
     and accent borders — never on section-header label text.
   - Section headers always use primary text color.
   - Brand green used only for top accent bar and footer wordmark.

   ═══════════════════════════════════════════════════════════════════ */

import type { RGB } from "../contracts/PdfRender";

/* ── Font map ──
   F1 = Helvetica         → body/UI (Sintony stand-in)
   F2 = Helvetica-Bold    → headings, labels, emphasis
   F5 = Courier           → data values, mono tabular
   F6 = Courier-Bold      → (reserved, rarely used)

   F3/F4 (Caudex serif) are still embedded for backward compat
   but the stylesheet never selects them for report content.
*/
export type PdfFontRef = "F1" | "F2" | "F3" | "F4" | "F5" | "F6";

/* ═══════════════════════════════════════════════════════════════════
   PAGE GEOMETRY
   ═══════════════════════════════════════════════════════════════════ */

export const PAGE = {
  width: 612,         // 8.5″ Letter
  height: 792,        // 11″ Letter
  marginLeft: 48,
  marginRight: 48,
  contentWidth: 516,  // 612 − 48 − 48
  top: 730,
  bottom: 56,
} as const;

/* ═══════════════════════════════════════════════════════════════════
   SPACING — 12pt base unit, all multiples
   ═══════════════════════════════════════════════════════════════════ */

export const SPACE: {
  /** 12pt — tight gap between related elements */
  readonly xs: number;
  /** 24pt — standard paragraph/component gap */
  readonly sm: number;
  /** 36pt — larger break between subsections */
  readonly md: number;
  /** 48pt — section gap */
  readonly lg: number;
} = {
  xs: 12,
  sm: 24,
  md: 36,
  lg: 48,
};

/* ═══════════════════════════════════════════════════════════════════
   TYPE SCALE — 4 sizes only
   ═══════════════════════════════════════════════════════════════════ */

export type TextPreset = {
  font: PdfFontRef;
  size: number;
  lineHeight: number;
  color: RGB;
  maxChars: number;
  marginTop: number;
};

export const TYPE = {
  /** Report title — one occurrence per document */
  title: {
    font: "F2" as PdfFontRef,
    size: 18,
    lineHeight: 22,
    color: [0.067, 0.067, 0.067] as RGB,   // primary
    maxChars: 50,
    marginTop: 0,
  },
  /** Section header inline text (used by renderSectionHeader) */
  heading: {
    font: "F2" as PdfFontRef,
    size: 11,
    lineHeight: 15,
    color: [0.067, 0.067, 0.067] as RGB,   // primary
    maxChars: 72,
    marginTop: SPACE.sm,
  },
  /** Subheading / subtitle */
  subheading: {
    font: "F1" as PdfFontRef,
    size: 11,
    lineHeight: 15,
    color: [0.420, 0.443, 0.502] as RGB,   // secondary
    maxChars: 76,
    marginTop: SPACE.xs,
  },
  /** Body text, table cells, card content */
  body: {
    font: "F1" as PdfFontRef,
    size: 9.5,
    lineHeight: 14,
    color: [0.420, 0.443, 0.502] as RGB,   // secondary
    maxChars: 90,
    marginTop: 0,
  },
  /** Captions, footnotes, meta labels */
  caption: {
    font: "F1" as PdfFontRef,
    size: 8,
    lineHeight: 11,
    color: [0.541, 0.561, 0.596] as RGB,   // muted
    maxChars: 105,
    marginTop: 0,
  },
} as const satisfies Record<string, TextPreset>;

/* ═══════════════════════════════════════════════════════════════════
   COLORS
   ═══════════════════════════════════════════════════════════════════ */

/** Text colors — only these three for report content */
export const TEXT = {
  primary: [0.067, 0.067, 0.067] as RGB,     // #111 — headings, values
  secondary: [0.420, 0.443, 0.502] as RGB,   // #6b7180 — body, descriptions
  muted: [0.541, 0.561, 0.596] as RGB,       // #8a8f98 — captions, meta
} as const;

/** Brand colors — structural accents only */
export const BRAND = {
  forest900: [0.0, 0.278, 0.145] as RGB,       // #004726
  forest950: [0.0, 0.165, 0.082] as RGB,       // #002a15
  forest100: [0.863, 0.941, 0.882] as RGB,     // #dcf0e1
  positive: [0.086, 0.639, 0.29] as RGB,       // #16a34a
} as const;

/** Status/severity — badges and accent borders ONLY */
export const STATUS = {
  critical: [0.937, 0.267, 0.267] as RGB,      // #ef4444
  warning: [0.961, 0.620, 0.043] as RGB,       // #f59e0b
  info: [0.086, 0.639, 0.290] as RGB,          // #16a34a
} as const;

/** Badge background/foreground pairs */
export const BADGE = {
  positive: { bg: [0.863, 0.988, 0.906] as RGB, fg: [0.0, 0.278, 0.149] as RGB },
  warning:  { bg: [0.996, 0.953, 0.780] as RGB, fg: [0.573, 0.251, 0.055] as RGB },
  danger:   { bg: [0.996, 0.886, 0.886] as RGB, fg: [0.600, 0.106, 0.106] as RGB },
  info:     { bg: [0.859, 0.918, 0.996] as RGB, fg: [0.118, 0.251, 0.686] as RGB },
} as const;

/** Surfaces */
export const SURFACE = {
  white: [1, 1, 1] as RGB,
  stripe: [0.969, 0.973, 0.969] as RGB,        // #f7f8f7 — table alt row
  section: [0.973, 0.973, 0.976] as RGB,       // #f8f8f9
  border: [0.902, 0.918, 0.914] as RGB,        // dividers, card borders
  grid: [0.88, 0.90, 0.89] as RGB,             // chart grid lines
} as const;

/* ═══════════════════════════════════════════════════════════════════
   TABLE DIMENSIONS — comfortable reading
   ═══════════════════════════════════════════════════════════════════ */

export const TABLE = {
  rowHeight: 24,
  headerHeight: 28,
  cellPaddingH: 10,
  cellPaddingV: 7,
  fontSize: 9.5,
  headerFontSize: 8,
  headerFont: "F2" as PdfFontRef,
  cellFont: "F1" as PdfFontRef,
  cellFontBold: "F2" as PdfFontRef,
  headerBg: [0.0, 0.278, 0.145] as RGB,        // forest900
  headerFg: [1, 1, 1] as RGB,
  stripeBg: [0.969, 0.973, 0.969] as RGB,
  accentWidth: 2.5,
  dividerWidth: 0.25,
  dividerColor: [0.902, 0.918, 0.914] as RGB,
} as const;

/* ═══════════════════════════════════════════════════════════════════
   METRIC GRID DIMENSIONS
   ═══════════════════════════════════════════════════════════════════ */

export const METRIC_GRID = {
  cellHeight: 48,
  gap: 8,
  labelFont: "F2" as PdfFontRef,
  labelSize: 8,
  valueFont: "F2" as PdfFontRef,       // single font — no serif/mono switching
  valueSize: 14,
  subFont: "F1" as PdfFontRef,
  subSize: 8,
  accentWidth: 3,
} as const;

/* ═══════════════════════════════════════════════════════════════════
   METRIC STRIP DIMENSIONS
   ═══════════════════════════════════════════════════════════════════ */

export const METRIC_STRIP = {
  height: 48,
  labelFont: "F2" as PdfFontRef,
  labelSize: 8,
  valueFont: "F2" as PdfFontRef,
  valueSize: 14,
} as const;

/* ═══════════════════════════════════════════════════════════════════
   SECTION HEADER
   ═══════════════════════════════════════════════════════════════════ */

export const SECTION_HEADER = {
  ruleWidth: 0.75,
  ruleColor: BRAND.forest900 as RGB,
  labelFont: "F2" as PdfFontRef,
  labelSize: 9.5,
  metaFont: "F1" as PdfFontRef,
  metaSize: 8,
  marginTop: SPACE.sm,
} as const;

/* ═══════════════════════════════════════════════════════════════════
   SEVERITY CARD
   ═══════════════════════════════════════════════════════════════════ */

export const SEVERITY_CARD = {
  accentWidth: 3,
  titleFont: "F2" as PdfFontRef,
  titleSize: 9.5,
  bodyFont: "F1" as PdfFontRef,
  bodySize: 9.5,
  bodyLineHeight: 13,
  detailFont: "F1" as PdfFontRef,
  detailSize: 8,
  detailLineHeight: 11,
  actionFont: "F2" as PdfFontRef,
  actionSize: 9.5,
  actionColor: BRAND.forest900 as RGB,
  badgeFont: "F2" as PdfFontRef,
  badgeSize: 7,
} as const;

/* ═══════════════════════════════════════════════════════════════════
   PROGRESS BAR
   ═══════════════════════════════════════════════════════════════════ */

export const PROGRESS_BAR = {
  labelFont: "F2" as PdfFontRef,
  labelSize: 9.5,
  trackHeight: 8,
  rangeLabelFont: "F1" as PdfFontRef,
  rangeLabelSize: 8,
} as const;

/* ═══════════════════════════════════════════════════════════════════
   SPARKLINE / CHART
   ═══════════════════════════════════════════════════════════════════ */

export const CHART = {
  labelFont: "F2" as PdfFontRef,
  labelSize: 9.5,
  axisFont: "F1" as PdfFontRef,
  axisSize: 7,
  lastValueFont: "F2" as PdfFontRef,
  lastValueSize: 8,
  legendFont: "F1" as PdfFontRef,
  legendSize: 8,
  defaultHeight: 48,
  multiHeight: 56,
  axisWidth: 32,
  padding: 6,
} as const;

/* ═══════════════════════════════════════════════════════════════════
   PAGE CHROME
   ═══════════════════════════════════════════════════════════════════ */

export const CHROME = {
  topBarHeight: 6,
  topBarColor: BRAND.forest950 as RGB,
  headerLineY: 756,
  footerLineY: 42,
  pageNumFont: "F5" as PdfFontRef,
  pageNumSize: 7.5,
  wordmarkFont: "F2" as PdfFontRef,
  wordmarkSize: 7.5,
  confidentialFont: "F1" as PdfFontRef,
  confidentialSize: 7,
  titleEchoFont: "F1" as PdfFontRef,
  titleEchoSize: 9.5,
} as const;

/* ═══════════════════════════════════════════════════════════════════
   KEY-VALUE
   ═══════════════════════════════════════════════════════════════════ */

export const KEY_VALUE = {
  rowHeight: 16,
  keyFont: "F2" as PdfFontRef,
  keySize: 9.5,
  valueFont: "F1" as PdfFontRef,
  valueSize: 9.5,
  keyIndent: 160,
} as const;

/* ═══════════════════════════════════════════════════════════════════
   STATUS BADGE (full-width)
   ═══════════════════════════════════════════════════════════════════ */

export const STATUS_BADGE = {
  font: "F2" as PdfFontRef,
  size: 11,
  height: 22,
} as const;
