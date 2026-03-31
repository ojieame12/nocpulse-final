import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import type {
  PdfBinaryRenderResult,
  PdfBlock,
  PdfRenderInput,
  PdfTextStyle,
} from "../contracts/PdfRender";

/* ═══════════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════════ */

type PdfFontRef = "F1" | "F2";

type LayoutStyle = {
  font: PdfFontRef;
  fontSize: number;
  lineHeight: number;
  marginTop: number;
  maxChars: number;
  color: readonly [number, number, number];
};

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_LEFT = 54;
const MARGIN_RIGHT = 54;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
const PAGE_TOP = 736;
const PAGE_BOTTOM = 62;

/** Brand colors */
const COLOR_TEAL: readonly [number, number, number] = [0.08, 0.24, 0.17];
const COLOR_DARK: readonly [number, number, number] = [0.12, 0.12, 0.12];
const COLOR_MID: readonly [number, number, number] = [0.18, 0.18, 0.18];
const COLOR_BODY: readonly [number, number, number] = [0.14, 0.14, 0.14];
const COLOR_MUTED: readonly [number, number, number] = [0.4, 0.4, 0.4];
const COLOR_RULE: readonly [number, number, number] = [0.82, 0.82, 0.82];

/** Status intent → fill color (background) and text color */
const STATUS_FILLS: Record<string, { bg: readonly [number, number, number]; fg: readonly [number, number, number] }> = {
  positive: { bg: [0.863, 0.988, 0.906], fg: [0.0, 0.278, 0.149] },  // #dcfce7 / #004726
  warning:  { bg: [0.996, 0.953, 0.780], fg: [0.573, 0.251, 0.055] }, // #fef3c7 / #92400e
  danger:   { bg: [0.996, 0.886, 0.886], fg: [0.600, 0.106, 0.106] }, // #fee2e2 / #991b1b
  info:     { bg: [0.859, 0.918, 0.976], fg: [0.118, 0.251, 0.686] }, // #dbeafe / #1e40af
  neutral:  { bg: [0.957, 0.957, 0.961], fg: [0.216, 0.255, 0.318] }, // #f4f4f5 / #374151
};

const STYLES: Record<PdfTextStyle, LayoutStyle> = {
  title: {
    font: "F2",
    fontSize: 20,
    lineHeight: 28,
    marginTop: 0,
    maxChars: 44,
    color: COLOR_TEAL,
  },
  heading: {
    font: "F2",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 16,
    maxChars: 70,
    color: COLOR_DARK,
  },
  subheading: {
    font: "F2",
    fontSize: 10.5,
    lineHeight: 15,
    marginTop: 10,
    maxChars: 82,
    color: COLOR_MID,
  },
  body: {
    font: "F1",
    fontSize: 10,
    lineHeight: 13.5,
    marginTop: 2,
    maxChars: 94,
    color: COLOR_BODY,
  },
  caption: {
    font: "F1",
    fontSize: 9,
    lineHeight: 12,
    marginTop: 2,
    maxChars: 102,
    color: COLOR_MUTED,
  },
};

/** Key-value layout */
const KV_LABEL_WIDTH = 180;
const KV_VALUE_X = MARGIN_LEFT + KV_LABEL_WIDTH + 8;
const KV_LABEL_MAX_CHARS = 30;
const KV_VALUE_MAX_CHARS = 56;

/** Metric row */
const METRIC_LABEL_MAX_CHARS = 18;
const METRIC_VALUE_MAX_CHARS = 12;

/* ═══════════════════════════════════════════════════════════════════
   Positioned layout elements
   ═══════════════════════════════════════════════════════════════════ */

type PositionedText = {
  kind: "text";
  font: PdfFontRef;
  fontSize: number;
  color: readonly [number, number, number];
  text: string;
  x: number;
  y: number;
};

type PositionedRule = {
  kind: "rule";
  x: number;
  y: number;
  width: number;
  weight: number;
  color: readonly [number, number, number];
};

type PositionedRect = {
  kind: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  fillColor: readonly [number, number, number];
};

type PositionedElement = PositionedText | PositionedRule | PositionedRect;

/* ═══════════════════════════════════════════════════════════════════
   Text utilities
   ═══════════════════════════════════════════════════════════════════ */

function wrapText(text: string, maxChars: number): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length === 0) return [];

  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (word.length > maxChars) {
      if (current) { lines.push(current); current = ""; }
      for (let i = 0; i < word.length; i += maxChars) {
        lines.push(word.slice(i, i + maxChars));
      }
      continue;
    }
    if (!current) { current = word; continue; }
    const candidate = `${current} ${word}`;
    if (candidate.length <= maxChars) { current = candidate; continue; }
    lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines;
}

function escapePdfText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r/g, " ")
    .replace(/\n/g, " ");
}

/** Rough char-width estimation for Helvetica at a given font size. */
function estimateTextWidth(text: string, fontSize: number, bold = false): number {
  const avgCharWidth = bold ? fontSize * 0.58 : fontSize * 0.52;
  return text.length * avgCharWidth;
}

/* ═══════════════════════════════════════════════════════════════════
   Layout engine
   ═══════════════════════════════════════════════════════════════════ */

function layoutBlocks(blocks: readonly PdfBlock[]): PositionedElement[][] {
  const pages: PositionedElement[][] = [[]];
  let pageIndex = 0;
  let y = PAGE_TOP;

  const beginNextPage = () => {
    pages.push([]);
    pageIndex += 1;
    y = PAGE_TOP;
  };

  const ensureSpace = (needed: number) => {
    if (y - needed < PAGE_BOTTOM) beginNextPage();
  };

  const emit = (el: PositionedElement) => {
    pages[pageIndex].push(el);
  };

  for (const block of blocks) {
    const blockType = block.type ?? "text";

    /* ── Text block ── */
    if (blockType === "text" && "style" in block && "text" in block) {
      const style = STYLES[block.style];
      const lines = wrapText(block.text, style.maxChars);
      if (lines.length === 0) continue;

      if (pages[pageIndex].length > 0) {
        const nextY = y - style.marginTop;
        if (nextY < PAGE_BOTTOM) { beginNextPage(); }
        else { y = nextY; }
      }

      for (const line of lines) {
        ensureSpace(style.lineHeight);
        emit({ kind: "text", font: style.font, fontSize: style.fontSize, color: style.color, text: line, x: MARGIN_LEFT, y });
        y -= style.lineHeight;
      }
      continue;
    }

    /* ── Divider ── */
    if (blockType === "divider") {
      const weight = ("weight" in block && block.weight) || 0.5;
      const color = ("color" in block && block.color) || COLOR_RULE;
      const marginTop = 8;
      const marginBottom = 6;

      if (pages[pageIndex].length > 0) {
        y -= marginTop;
      }
      ensureSpace(weight + marginBottom);
      emit({ kind: "rule", x: MARGIN_LEFT, y, width: CONTENT_WIDTH, weight, color });
      y -= weight + marginBottom;
      continue;
    }

    /* ── Spacer ── */
    if (blockType === "spacer") {
      const height = ("height" in block && block.height) || 8;
      y -= height;
      if (y < PAGE_BOTTOM) beginNextPage();
      continue;
    }

    /* ── Key-Value ── */
    if (blockType === "key-value" && "label" in block && "value" in block) {
      const labelLines = wrapText(block.label, KV_LABEL_MAX_CHARS);
      const valueLines = wrapText(block.value + (block.suffix ? ` ${block.suffix}` : ""), KV_VALUE_MAX_CHARS);
      const rowLines = Math.max(labelLines.length, valueLines.length, 1);
      const rowHeight = rowLines * 13.5 + 3;

      if (pages[pageIndex].length > 0) y -= 2;
      ensureSpace(rowHeight);

      /* Subtle alternating row background */
      const rowParity = pages[pageIndex].filter((el) => el.kind === "rect").length % 2;
      if (rowParity === 0) {
        emit({ kind: "rect", x: MARGIN_LEFT - 4, y: y + 10, width: CONTENT_WIDTH + 8, height: -(rowHeight), fillColor: [0.97, 0.97, 0.975] });
      }

      let lineY = y;
      for (let i = 0; i < rowLines; i++) {
        if (labelLines[i]) {
          emit({ kind: "text", font: "F1", fontSize: 9.5, color: COLOR_MUTED, text: labelLines[i], x: MARGIN_LEFT, y: lineY });
        }
        if (valueLines[i]) {
          emit({ kind: "text", font: "F2", fontSize: 10, color: COLOR_DARK, text: valueLines[i], x: KV_VALUE_X, y: lineY });
        }
        lineY -= 13.5;
      }
      y -= rowHeight;
      continue;
    }

    /* ── Metric Row ── */
    if (blockType === "metric-row" && "items" in block) {
      const items = block.items;
      if (items.length === 0) continue;

      const colCount = Math.min(items.length, 4);
      const colWidth = CONTENT_WIDTH / colCount;
      const rowHeight = 28;

      if (pages[pageIndex].length > 0) y -= 6;
      ensureSpace(rowHeight);

      for (let i = 0; i < colCount; i++) {
        const item = items[i];
        const colX = MARGIN_LEFT + i * colWidth;

        /* Value (bold, larger) */
        emit({ kind: "text", font: "F2", fontSize: 11, color: COLOR_DARK, text: item.value.slice(0, METRIC_VALUE_MAX_CHARS), x: colX, y });
        /* Label (smaller, muted) */
        emit({ kind: "text", font: "F1", fontSize: 8.5, color: COLOR_MUTED, text: item.label.slice(0, METRIC_LABEL_MAX_CHARS), x: colX, y: y - 13 });
      }
      y -= rowHeight;

      /* Remaining items on next rows */
      if (items.length > 4) {
        for (let start = 4; start < items.length; start += 4) {
          const slice = items.slice(start, start + 4);
          const sliceCols = Math.min(slice.length, 4);
          ensureSpace(rowHeight);
          for (let i = 0; i < sliceCols; i++) {
            const item = slice[i];
            const colX = MARGIN_LEFT + i * colWidth;
            emit({ kind: "text", font: "F2", fontSize: 11, color: COLOR_DARK, text: item.value.slice(0, METRIC_VALUE_MAX_CHARS), x: colX, y });
            emit({ kind: "text", font: "F1", fontSize: 8.5, color: COLOR_MUTED, text: item.label.slice(0, METRIC_LABEL_MAX_CHARS), x: colX, y: y - 13 });
          }
          y -= rowHeight;
        }
      }
      continue;
    }

    /* ── Status badge ── */
    if (blockType === "status" && "label" in block && "status" in block && "intent" in block) {
      const intent = STATUS_FILLS[block.intent] ?? STATUS_FILLS.neutral;
      const labelText = block.label;
      const statusText = block.status;
      const rowHeight = 18;

      if (pages[pageIndex].length > 0) y -= 4;
      ensureSpace(rowHeight);

      /* Label */
      emit({ kind: "text", font: "F1", fontSize: 10, color: COLOR_BODY, text: labelText, x: MARGIN_LEFT, y });

      /* Badge pill */
      const badgeX = MARGIN_LEFT + estimateTextWidth(labelText, 10) + 10;
      const badgeTextWidth = estimateTextWidth(statusText, 8.5, true);
      const pillWidth = badgeTextWidth + 12;
      const pillHeight = 14;
      const pillY = y - 3;

      emit({ kind: "rect", x: badgeX, y: pillY + pillHeight, width: pillWidth, height: -pillHeight, fillColor: intent.bg });
      emit({ kind: "text", font: "F2", fontSize: 8.5, color: intent.fg, text: statusText, x: badgeX + 6, y: pillY + 4 });

      y -= rowHeight;
      continue;
    }
  }

  return pages;
}

/* ═══════════════════════════════════════════════════════════════════
   PDF stream builders
   ═══════════════════════════════════════════════════════════════════ */

function createTextCommand(
  text: string,
  font: PdfFontRef,
  fontSize: number,
  x: number,
  y: number,
  color: readonly [number, number, number],
): string {
  const escaped = escapePdfText(text);
  const [r, g, b] = color;
  return [
    "BT",
    `/${font} ${fontSize} Tf`,
    `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`,
    `1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm`,
    `(${escaped}) Tj`,
    "ET",
  ].join("\n");
}

function createRuleCommand(
  x: number,
  y: number,
  width: number,
  weight: number,
  color: readonly [number, number, number],
): string {
  const [r, g, b] = color;
  return [
    `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG`,
    `${weight.toFixed(2)} w`,
    `${x.toFixed(2)} ${y.toFixed(2)} m`,
    `${(x + width).toFixed(2)} ${y.toFixed(2)} l`,
    "S",
  ].join("\n");
}

function createRectCommand(
  x: number,
  y: number,
  width: number,
  height: number,
  fillColor: readonly [number, number, number],
): string {
  const [r, g, b] = fillColor;
  return [
    `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`,
    `${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re`,
    "f",
  ].join("\n");
}

function buildPageStream(
  title: string,
  pageNumber: number,
  pageCount: number,
  elements: readonly PositionedElement[],
): string {
  const commands: string[] = [];

  /* Header bar — subtle teal line at the very top */
  commands.push(createRuleCommand(MARGIN_LEFT, PAGE_HEIGHT - 20, CONTENT_WIDTH, 1.5, COLOR_TEAL));

  /* Brand label */
  commands.push(
    createTextCommand("NocPulse", "F2", 9, MARGIN_LEFT, PAGE_HEIGHT - 16, COLOR_TEAL),
  );

  /* Page number footer */
  commands.push(
    createTextCommand(
      `${pageNumber} / ${pageCount}`,
      "F1",
      8,
      PAGE_WIDTH - MARGIN_RIGHT - 36,
      36,
      COLOR_MUTED,
    ),
  );

  /* Continuation title on pages 2+ */
  if (pageNumber > 1) {
    commands.push(
      createTextCommand(title, "F2", 11, MARGIN_LEFT, 752, COLOR_TEAL),
    );
  }

  /* Render all elements */
  for (const el of elements) {
    switch (el.kind) {
      case "text":
        commands.push(createTextCommand(el.text, el.font, el.fontSize, el.x, el.y, el.color));
        break;
      case "rule":
        commands.push(createRuleCommand(el.x, el.y, el.width, el.weight, el.color));
        break;
      case "rect":
        commands.push(createRectCommand(el.x, el.y, el.width, el.height, el.fillColor));
        break;
    }
  }

  return commands.join("\n");
}

/* ═══════════════════════════════════════════════════════════════════
   PDF document assembly (PDF 1.4)
   ═══════════════════════════════════════════════════════════════════ */

function buildPdfDocument(
  input: PdfRenderInput,
  pageStreams: readonly string[],
): Uint8Array {
  const fontRegularObject = 1;
  const fontBoldObject = 2;
  const firstContentObject = 3;
  const firstPageObject = firstContentObject + pageStreams.length;
  const pagesObject = firstPageObject + pageStreams.length;
  const catalogObject = pagesObject + 1;
  const infoObject = catalogObject + 1;

  const objects: string[] = [];
  objects[fontRegularObject] = [
    `${fontRegularObject} 0 obj`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "endobj",
  ].join("\n");
  objects[fontBoldObject] = [
    `${fontBoldObject} 0 obj`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    "endobj",
  ].join("\n");

  pageStreams.forEach((stream, index) => {
    const objectNumber = firstContentObject + index;
    const streamLength = Buffer.byteLength(stream, "utf8");

    objects[objectNumber] = [
      `${objectNumber} 0 obj`,
      `<< /Length ${streamLength} >>`,
      "stream",
      stream,
      "endstream",
      "endobj",
    ].join("\n");
  });

  pageStreams.forEach((_, index) => {
    const objectNumber = firstPageObject + index;
    const contentObject = firstContentObject + index;

    objects[objectNumber] = [
      `${objectNumber} 0 obj`,
      "<<",
      "/Type /Page",
      `/Parent ${pagesObject} 0 R`,
      `/MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}]`,
      `/Resources << /Font << /F1 ${fontRegularObject} 0 R /F2 ${fontBoldObject} 0 R >> >>`,
      `/Contents ${contentObject} 0 R`,
      ">>",
      "endobj",
    ].join("\n");
  });

  const kids = pageStreams
    .map((_, index) => `${firstPageObject + index} 0 R`)
    .join(" ");

  objects[pagesObject] = [
    `${pagesObject} 0 obj`,
    `<< /Type /Pages /Count ${pageStreams.length} /Kids [ ${kids} ] >>`,
    "endobj",
  ].join("\n");

  objects[catalogObject] = [
    `${catalogObject} 0 obj`,
    `<< /Type /Catalog /Pages ${pagesObject} 0 R >>`,
    "endobj",
  ].join("\n");

  const infoFields = [
    `/Title (${escapePdfText(input.title)})`,
    `/Author (${escapePdfText(input.author ?? "NocPulse")})`,
    `/Subject (${escapePdfText(input.subject ?? input.title)})`,
    "/Creator (NocPulse PDF Renderer)",
    "/Producer (NocPulse PDF Renderer)",
  ];

  objects[infoObject] = [
    `${infoObject} 0 obj`,
    `<< ${infoFields.join(" ")} >>`,
    "endobj",
  ].join("\n");

  let document = "%PDF-1.4\n";
  const offsets: number[] = [0];

  for (let objectNumber = 1; objectNumber < objects.length; objectNumber += 1) {
    offsets[objectNumber] = Buffer.byteLength(document, "utf8");
    document += `${objects[objectNumber]}\n`;
  }

  const startXref = Buffer.byteLength(document, "utf8");
  document += `xref\n0 ${objects.length}\n`;
  document += "0000000000 65535 f \n";

  for (let objectNumber = 1; objectNumber < objects.length; objectNumber += 1) {
    document += `${offsets[objectNumber].toString().padStart(10, "0")} 00000 n \n`;
  }

  document += [
    "trailer",
    `<< /Size ${objects.length} /Root ${catalogObject} 0 R /Info ${infoObject} 0 R >>`,
    "startxref",
    `${startXref}`,
    "%%EOF",
  ].join("\n");

  return Buffer.from(document, "utf8");
}

/* ═══════════════════════════════════════════════════════════════════
   Public entry point
   ═══════════════════════════════════════════════════════════════════ */

export function renderPdfDocument(
  input: PdfRenderInput,
): PdfBinaryRenderResult {
  const laidOutPages = layoutBlocks(input.blocks);
  const pageStreams = laidOutPages.map((page, index) =>
    buildPageStream(input.title, index + 1, laidOutPages.length, page),
  );
  const bytes = buildPdfDocument(input, pageStreams);
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  return {
    metadata: {
      artifactKey: input.artifactKey,
      pageCount: laidOutPages.length,
      byteSize: bytes.byteLength,
      sha256,
    },
    bytes,
  };
}
