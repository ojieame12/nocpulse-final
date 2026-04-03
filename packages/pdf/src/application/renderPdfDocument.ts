import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { deflateSync, inflateSync } from "node:zlib";
import type {
  PdfBrandLogo,
  PdfBinaryRenderResult,
  PdfBlock,
  PdfRenderInput,
  PdfTextStyle,
  RGB,
} from "../contracts/PdfRender";
import { parseTTF, generatePdfFontObjects, type EmbeddedFont, type PdfFontObjects } from "./ttfEmbed";
import { CAUDEX_REGULAR, CAUDEX_BOLD } from "./fontData";
import {
  PAGE, SPACE, TYPE, TEXT, BRAND, STATUS, BADGE, SURFACE,
  TABLE, METRIC_GRID, METRIC_STRIP, SECTION_HEADER,
  SEVERITY_CARD, PROGRESS_BAR, CHART, CHROME, KEY_VALUE,
  STATUS_BADGE,
  type PdfFontRef, type TextPreset,
} from "./PdfStyleSheet";

/* ═══════════════════════════════════════════════════════════════════
   NocPulse PDF Renderer — v3 (stylesheet-driven)
   ═══════════════════════════════════════════════════════════════════ */

/* ── Embedded fonts ──
   Caudex TTF data is inlined as base64 in fontData.ts so it works on
   serverless platforms without filesystem access. Kept for backward
   compatibility but the stylesheet no longer selects serif for reports.
*/
let _serifRegular: EmbeddedFont | null = null;
let _serifBold: EmbeddedFont | null = null;
let _fontInitFailed = false;

function getSerifRegular(): EmbeddedFont | null {
  if (_fontInitFailed) return null;
  if (!_serifRegular) {
    try {
      _serifRegular = parseTTF(CAUDEX_REGULAR);
    } catch (err) {
      console.error("[NocPulse PDF] Failed to parse Caudex Regular font:", err);
      _fontInitFailed = true;
      return null;
    }
  }
  return _serifRegular;
}
function getSerifBold(): EmbeddedFont | null {
  if (_fontInitFailed) return null;
  if (!_serifBold) {
    try {
      _serifBold = parseTTF(CAUDEX_BOLD);
    } catch (err) {
      console.error("[NocPulse PDF] Failed to parse Caudex Bold font:", err);
      _fontInitFailed = true;
      return null;
    }
  }
  return _serifBold;
}

/* ── Shorthand aliases for stylesheet constants ── */
const ML = PAGE.marginLeft;
const CW = PAGE.contentWidth;
const PAGE_WIDTH = PAGE.width;
const PAGE_HEIGHT = PAGE.height;
const PAGE_TOP = PAGE.top;
const PAGE_BOTTOM = PAGE.bottom;

/* ── Text style presets (driven by PdfStyleSheet) ── */

type LayoutStyle = {
  font: PdfFontRef;
  fontSize: number;
  lineHeight: number;
  marginTop: number;
  maxChars: number;
  color: RGB;
};

const STYLES: Record<PdfTextStyle, LayoutStyle> = {
  title: {
    font: TYPE.title.font,
    fontSize: TYPE.title.size,
    lineHeight: TYPE.title.lineHeight,
    marginTop: TYPE.title.marginTop,
    maxChars: TYPE.title.maxChars,
    color: TYPE.title.color,
  },
  heading: {
    font: TYPE.heading.font,
    fontSize: TYPE.heading.size,
    lineHeight: TYPE.heading.lineHeight,
    marginTop: TYPE.heading.marginTop,
    maxChars: TYPE.heading.maxChars,
    color: TYPE.heading.color,
  },
  subheading: {
    font: TYPE.subheading.font,
    fontSize: TYPE.subheading.size,
    lineHeight: TYPE.subheading.lineHeight,
    marginTop: TYPE.subheading.marginTop,
    maxChars: TYPE.subheading.maxChars,
    color: TYPE.subheading.color,
  },
  body: {
    font: TYPE.body.font,
    fontSize: TYPE.body.size,
    lineHeight: TYPE.body.lineHeight,
    marginTop: TYPE.body.marginTop,
    maxChars: TYPE.body.maxChars,
    color: TYPE.body.color,
  },
  caption: {
    font: TYPE.caption.font,
    fontSize: TYPE.caption.size,
    lineHeight: TYPE.caption.lineHeight,
    marginTop: TYPE.caption.marginTop,
    maxChars: TYPE.caption.maxChars,
    color: TYPE.caption.color,
  },
};

/* ── PDF graphics primitives ── */

/**
 * Map Unicode characters to WinAnsiEncoding byte values.
 * Standard PDF Type 1 fonts use WinAnsiEncoding which supports
 * Latin-1 supplement + common typographic characters at specific code points.
 */
const UNICODE_TO_WINANSI: Record<string, number> = {
  "\u2013": 0x96, // en dash –
  "\u2014": 0x97, // em dash —
  "\u2018": 0x91, // left single quote '
  "\u2019": 0x92, // right single quote '
  "\u201C": 0x93, // left double quote "
  "\u201D": 0x94, // right double quote "
  "\u2022": 0x95, // bullet •
  "\u2026": 0x85, // ellipsis …
  "\u2020": 0x86, // dagger †
  "\u2021": 0x87, // double dagger ‡
  "\u2030": 0x89, // per mille ‰
  "\u0152": 0x8C, // OE ligature Œ
  "\u0153": 0x9C, // oe ligature œ
  "\u2122": 0x99, // trademark ™
  "\u00B0": 0xB0, // degree °
};

function escapePdfText(value: string) {
  let result = "";
  for (const ch of value) {
    if (ch === "\\") result += "\\\\";
    else if (ch === "(") result += "\\(";
    else if (ch === ")") result += "\\)";
    else if (ch === "\r" || ch === "\n") result += " ";
    else if (UNICODE_TO_WINANSI[ch] !== undefined) {
      // Emit as octal escape for WinAnsiEncoding
      result += "\\" + UNICODE_TO_WINANSI[ch].toString(8).padStart(3, "0");
    } else {
      const code = ch.charCodeAt(0);
      if (code <= 0x7E) {
        // ASCII printable — safe to emit directly
        result += ch;
      } else if (code <= 0xFF) {
        // Latin-1 supplement (0x7F–0xFF) — must use octal escape
        // to avoid UTF-8 multi-byte corruption in the PDF stream
        result += "\\" + code.toString(8).padStart(3, "0");
      } else {
        // Unmapped Unicode above U+00FF — replace with placeholder
        result += "?";
      }
    }
  }
  return result;
}

function textCmd(
  text: string,
  font: PdfFontRef,
  fontSize: number,
  x: number,
  y: number,
  color: RGB,
) {
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

function rectCmd(x: number, y: number, w: number, h: number, color: RGB) {
  const [r, g, b] = color;
  return [
    "q",
    `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`,
    `${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re`,
    "f",
    "Q",
  ].join("\n");
}

function lineCmd(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  color: RGB,
) {
  const [r, g, b] = color;
  return [
    "q",
    `${width.toFixed(2)} w`,
    `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG`,
    `${x1.toFixed(2)} ${y1.toFixed(2)} m`,
    `${x2.toFixed(2)} ${y2.toFixed(2)} l`,
    "S",
    "Q",
  ].join("\n");
}

/** Polyline stroke for sparklines */
function polylineCmd(
  points: readonly { x: number; y: number }[],
  width: number,
  color: RGB,
) {
  if (points.length < 2) return "";
  const [r, g, b] = color;
  const cmds: string[] = [
    "q",
    `${width.toFixed(2)} w`,
    `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG`,
    `${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)} m`,
  ];
  for (let i = 1; i < points.length; i++) {
    cmds.push(`${points[i].x.toFixed(2)} ${points[i].y.toFixed(2)} l`);
  }
  cmds.push("S", "Q");
  return cmds.join("\n");
}

/** Smooth polyline using cubic Bezier curves through data points */
function smoothPolylineCmd(
  points: readonly { x: number; y: number }[],
  width: number,
  color: RGB,
) {
  if (points.length < 2) return polylineCmd(points, width, color);
  const [r, g, b] = color;
  const cmds: string[] = [
    "q",
    `${width.toFixed(2)} w`,
    "1 J", // round line cap
    "1 j", // round line join
    `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG`,
    `${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)} m`,
  ];
  // Catmull-Rom → Bezier conversion for smooth curves
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const tension = 0.35;
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;
    cmds.push(
      `${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ${cp2x.toFixed(2)} ${cp2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} c`,
    );
  }
  cmds.push("S", "Q");
  return cmds.join("\n");
}

/** Filled area under a smooth curve (for area charts) */
function smoothAreaFillCmd(
  points: readonly { x: number; y: number }[],
  baselineY: number,
  color: RGB,
  opacity: number,
) {
  if (points.length < 2) return "";
  const [r, g, b] = color;
  const cmds: string[] = [
    "q",
    `/GS1 gs`, // use graphics state for opacity
    `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`,
    // Start at baseline under first point
    `${points[0].x.toFixed(2)} ${baselineY.toFixed(2)} m`,
    // Line up to first data point
    `${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)} l`,
  ];
  // Smooth curve through data points (same Catmull-Rom → Bezier)
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const tension = 0.35;
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;
    cmds.push(
      `${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ${cp2x.toFixed(2)} ${cp2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} c`,
    );
  }
  // Close back to baseline
  const last = points[points.length - 1];
  cmds.push(`${last.x.toFixed(2)} ${baselineY.toFixed(2)} l`);
  cmds.push("f", "Q");
  return cmds.join("\n");
}

/** Small filled circle (for data point markers) */
function circleCmd(cx: number, cy: number, radius: number, color: RGB) {
  const [r, g, b] = color;
  // Approximate circle with 4 Bezier curves (kappa = 0.5523)
  const k = radius * 0.5523;
  return [
    "q",
    `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`,
    `${(cx - radius).toFixed(2)} ${cy.toFixed(2)} m`,
    `${(cx - radius).toFixed(2)} ${(cy + k).toFixed(2)} ${(cx - k).toFixed(2)} ${(cy + radius).toFixed(2)} ${cx.toFixed(2)} ${(cy + radius).toFixed(2)} c`,
    `${(cx + k).toFixed(2)} ${(cy + radius).toFixed(2)} ${(cx + radius).toFixed(2)} ${(cy + k).toFixed(2)} ${(cx + radius).toFixed(2)} ${cy.toFixed(2)} c`,
    `${(cx + radius).toFixed(2)} ${(cy - k).toFixed(2)} ${(cx + k).toFixed(2)} ${(cy - radius).toFixed(2)} ${cx.toFixed(2)} ${(cy - radius).toFixed(2)} c`,
    `${(cx - k).toFixed(2)} ${(cy - radius).toFixed(2)} ${(cx - radius).toFixed(2)} ${(cy - k).toFixed(2)} ${(cx - radius).toFixed(2)} ${cy.toFixed(2)} c`,
    "f",
    "Q",
  ].join("\n");
}

/** Dashed horizontal line for grid */
function dashedLineCmd(
  x1: number,
  y: number,
  x2: number,
  width: number,
  color: RGB,
) {
  const [r, g, b] = color;
  return [
    "q",
    `${width.toFixed(2)} w`,
    `[3 3] 0 d`, // 3pt dash, 3pt gap
    `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG`,
    `${x1.toFixed(2)} ${y.toFixed(2)} m`,
    `${x2.toFixed(2)} ${y.toFixed(2)} l`,
    "S",
    "Q",
  ].join("\n");
}

/** Format a number for axis labels — compact and readable */
function formatAxisValue(value: number): string {
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}k`;
  if (Math.abs(value) >= 100) return `${Math.round(value)}`;
  if (Math.abs(value) >= 10) return `${value.toFixed(1)}`;
  if (Math.abs(value) >= 1) return `${value.toFixed(1)}`;
  return `${value.toFixed(2)}`;
}

function imageCmd(
  x: number,
  y: number,
  width: number,
  height: number,
  imageName: string,
) {
  return [
    "q",
    `${width.toFixed(2)} 0 0 ${height.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm`,
    `/${imageName} Do`,
    "Q",
  ].join("\n");
}

/* ── Text width estimation (Helvetica approximation) ── */

function estimateTextWidth(text: string, fontSize: number, font: PdfFontRef = "F1") {
  // For embedded Playfair Display, use real glyph widths
  if (font === "F3") {
    const f = getSerifRegular();
    return f ? f.measureText(text, fontSize) : text.length * fontSize * 0.5; // fallback estimate
  }
  if (font === "F4") {
    const f = getSerifBold();
    return f ? f.measureText(text, fontSize) : text.length * fontSize * 0.55; // fallback estimate
  }
  // Average character widths for built-in PDF fonts
  const avgCharWidth =
    font === "F5" || font === "F6" ? 0.60 // Courier (monospaced)
      : font === "F2" ? 0.56 // Helvetica-Bold
        : 0.52; // Helvetica
  return text.length * fontSize * avgCharWidth;
}

function wrapText(text: string, maxChars: number) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length === 0) return [];

  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (word.length > maxChars) {
      if (current) { lines.push(current); current = ""; }
      for (let index = 0; index < word.length; index += maxChars) {
        lines.push(word.slice(index, index + maxChars));
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

function truncate(text: string, maxChars: number) {
  return text.length > maxChars ? text.slice(0, maxChars - 1) + "\u2026" : text;
}

type PngPdfImage = {
  width: number;
  height: number;
  rgbHex: string;
  alphaHex?: string;
};

function paethPredictor(left: number, up: number, upLeft: number) {
  const prediction = left + up - upLeft;
  const leftDistance = Math.abs(prediction - left);
  const upDistance = Math.abs(prediction - up);
  const upLeftDistance = Math.abs(prediction - upLeft);
  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) return left;
  if (upDistance <= upLeftDistance) return up;
  return upLeft;
}

function decodePngLogo(logo: PdfBrandLogo): PngPdfImage {
  const bytes = Buffer.from(logo.bytes);
  const signature = bytes.subarray(0, 8);
  if (!signature.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    throw new Error("Unsupported PDF brand logo: invalid PNG signature");
  }

  let cursor = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idatChunks: Buffer[] = [];

  while (cursor + 8 <= bytes.length) {
    const chunkLength = bytes.readUInt32BE(cursor);
    cursor += 4;
    const chunkType = bytes.subarray(cursor, cursor + 4).toString("ascii");
    cursor += 4;
    const chunkData = bytes.subarray(cursor, cursor + chunkLength);
    cursor += chunkLength + 4;

    if (chunkType === "IHDR") {
      width = chunkData.readUInt32BE(0);
      height = chunkData.readUInt32BE(4);
      bitDepth = chunkData[8];
      colorType = chunkData[9];
      interlace = chunkData[12];
    } else if (chunkType === "IDAT") {
      idatChunks.push(chunkData);
    } else if (chunkType === "IEND") {
      break;
    }
  }

  if (!width || !height || idatChunks.length === 0) {
    throw new Error("Unsupported PDF brand logo: incomplete PNG");
  }
  if (bitDepth !== 8 || interlace !== 0 || (colorType !== 2 && colorType !== 6)) {
    throw new Error("Unsupported PDF brand logo: only 8-bit non-interlaced RGB/RGBA PNG is supported");
  }

  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const filtered = inflateSync(Buffer.concat(idatChunks));
  const expectedLength = height * (stride + 1);
  if (filtered.length < expectedLength) {
    throw new Error("Unsupported PDF brand logo: truncated PNG data");
  }

  const raw = Buffer.alloc(width * height * channels);
  let srcOffset = 0;

  for (let row = 0; row < height; row += 1) {
    const filterType = filtered[srcOffset];
    srcOffset += 1;
    const rowOffset = row * stride;

    for (let column = 0; column < stride; column += 1) {
      const value = filtered[srcOffset++];
      const left = column >= channels ? raw[rowOffset + column - channels] : 0;
      const up = row > 0 ? raw[rowOffset + column - stride] : 0;
      const upLeft = row > 0 && column >= channels ? raw[rowOffset + column - stride - channels] : 0;

      switch (filterType) {
        case 0:
          raw[rowOffset + column] = value;
          break;
        case 1:
          raw[rowOffset + column] = (value + left) & 0xff;
          break;
        case 2:
          raw[rowOffset + column] = (value + up) & 0xff;
          break;
        case 3:
          raw[rowOffset + column] = (value + Math.floor((left + up) / 2)) & 0xff;
          break;
        case 4:
          raw[rowOffset + column] = (value + paethPredictor(left, up, upLeft)) & 0xff;
          break;
        default:
          throw new Error(`Unsupported PDF brand logo: PNG filter ${filterType}`);
      }
    }
  }

  const rgb = Buffer.alloc(width * height * 3);
  const alpha = colorType === 6 ? Buffer.alloc(width * height) : undefined;

  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const src = pixel * channels;
    const dst = pixel * 3;
    rgb[dst] = raw[src];
    rgb[dst + 1] = raw[src + 1];
    rgb[dst + 2] = raw[src + 2];
    if (alpha) alpha[pixel] = raw[src + 3];
  }

  return {
    width,
    height,
    rgbHex: `${deflateSync(rgb, { level: 9 }).toString("hex").toUpperCase()}>`,
    alphaHex: alpha ? `${deflateSync(alpha, { level: 9 }).toString("hex").toUpperCase()}>` : undefined,
  };
}

/* ═══════════════════════════════════════════════════════════════════
   Page-level layout engine
   ═══════════════════════════════════════════════════════════════════ */

type PageCommands = string[];

interface LayoutCtx {
  pages: PageCommands[];
  pageIndex: number;
  y: number;
}

function newPage(ctx: LayoutCtx) {
  ctx.pages.push([]);
  ctx.pageIndex = ctx.pages.length - 1;
  ctx.y = PAGE_TOP;
}

function curPage(ctx: LayoutCtx): PageCommands {
  return ctx.pages[ctx.pageIndex];
}

function ensureSpace(ctx: LayoutCtx, needed: number) {
  if (ctx.y - needed < PAGE_BOTTOM) {
    newPage(ctx);
  }
}

function advanceY(ctx: LayoutCtx, amount: number) {
  ctx.y -= amount;
}

/* ── Block renderers ── */

function renderTextBlock(
  ctx: LayoutCtx,
  style: PdfTextStyle,
  text: string,
) {
  const s = STYLES[style];
  const lines = wrapText(text, s.maxChars);
  if (lines.length === 0) return;

  if (curPage(ctx).length > 0 && s.marginTop > 0) {
    ensureSpace(ctx, s.marginTop + s.lineHeight);
    advanceY(ctx, s.marginTop);
  }

  for (const line of lines) {
    ensureSpace(ctx, s.lineHeight);
    curPage(ctx).push(textCmd(line, s.font, s.fontSize, ML, ctx.y, s.color));
    advanceY(ctx, s.lineHeight);
  }
}

function renderSpacer(ctx: LayoutCtx, height: number) {
  advanceY(ctx, height);
}

function renderDivider(
  ctx: LayoutCtx,
  color: RGB = SURFACE.border,
  thickness = 0.5,
  marginTop = SPACE.xs,
) {
  advanceY(ctx, marginTop);
  ensureSpace(ctx, 2);
  curPage(ctx).push(
    lineCmd(ML, ctx.y, ML + CW, ctx.y, thickness, color),
  );
  advanceY(ctx, SPACE.xs);
}

function renderSectionHeader(
  ctx: LayoutCtx,
  label: string,
  meta: string | undefined,
  _accentColor: RGB = BRAND.forest900,
  marginTop = SECTION_HEADER.marginTop,
) {
  advanceY(ctx, marginTop);
  ensureSpace(ctx, 28);

  // Thin rule — always brand green, never status-colored
  curPage(ctx).push(lineCmd(ML, ctx.y, ML + CW, ctx.y, SECTION_HEADER.ruleWidth, SECTION_HEADER.ruleColor));
  advanceY(ctx, SPACE.xs);

  // Label — uppercase, primary text color (never colored by severity)
  const upperLabel = label.toUpperCase();
  curPage(ctx).push(
    textCmd(upperLabel, SECTION_HEADER.labelFont, SECTION_HEADER.labelSize, ML, ctx.y, TEXT.primary),
  );

  // Right-aligned meta in muted weight
  if (meta) {
    const metaW = estimateTextWidth(meta, SECTION_HEADER.metaSize, SECTION_HEADER.metaFont);
    curPage(ctx).push(
      textCmd(meta, SECTION_HEADER.metaFont, SECTION_HEADER.metaSize, ML + CW - metaW, ctx.y, TEXT.muted),
    );
  }

  advanceY(ctx, SPACE.xs);
}

function renderMetricStrip(
  ctx: LayoutCtx,
  cells: readonly { label: string; value: string; valueColor?: RGB }[],
  marginTop = SPACE.xs,
) {
  if (cells.length === 0) return;
  const stripH = METRIC_STRIP.height;
  advanceY(ctx, marginTop);
  ensureSpace(ctx, stripH);

  const cellW = CW / cells.length;
  const baseY = ctx.y;

  // Background
  curPage(ctx).push(rectCmd(ML, baseY - stripH, CW, stripH, SURFACE.stripe));

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const cx = ML + i * cellW;

    // Vertical separator (skip first)
    if (i > 0) {
      curPage(ctx).push(
        lineCmd(cx, baseY - 6, cx, baseY - stripH + 6, 0.5, SURFACE.border),
      );
    }

    // Label (uppercase, muted)
    curPage(ctx).push(
      textCmd(
        truncate(cell.label.toUpperCase(), 18),
        METRIC_STRIP.labelFont,
        METRIC_STRIP.labelSize,
        cx + 10,
        baseY - 16,
        TEXT.muted,
      ),
    );

    // Value (bold, prominent)
    curPage(ctx).push(
      textCmd(
        truncate(cell.value, 14),
        METRIC_STRIP.valueFont,
        METRIC_STRIP.valueSize,
        cx + 10,
        baseY - 34,
        cell.valueColor ?? TEXT.primary,
      ),
    );
  }

  advanceY(ctx, stripH);
}

function renderMetricGrid(
  ctx: LayoutCtx,
  cells: readonly {
    label: string;
    value: string;
    sub?: string;
    valueColor?: RGB;
    accentColor?: RGB;
  }[],
  columns: 2 | 3 | 4 = 2,
  marginTop = SPACE.xs,
) {
  if (cells.length === 0) return;
  const gap = METRIC_GRID.gap;
  const cellW = (CW - gap * (columns - 1)) / columns;
  const cellH = METRIC_GRID.cellHeight;
  const rows = Math.ceil(cells.length / columns);

  advanceY(ctx, marginTop);

  for (let row = 0; row < rows; row++) {
    ensureSpace(ctx, cellH + gap);
    const baseY = ctx.y;

    for (let col = 0; col < columns; col++) {
      const idx = row * columns + col;
      if (idx >= cells.length) break;
      const cell = cells[idx];
      const cx = ML + col * (cellW + gap);

      // Card background
      curPage(ctx).push(rectCmd(cx, baseY - cellH, cellW, cellH, SURFACE.white));
      // Subtle bottom border
      curPage(ctx).push(lineCmd(cx, baseY - cellH, cx + cellW, baseY - cellH, 0.3, SURFACE.border));

      // Optional accent left border
      if (cell.accentColor) {
        curPage(ctx).push(
          rectCmd(cx, baseY - cellH, METRIC_GRID.accentWidth, cellH, cell.accentColor),
        );
      }

      const textX = cx + (cell.accentColor ? 14 : 12);

      // Label — single font, uppercase, muted
      curPage(ctx).push(
        textCmd(
          truncate(cell.label.toUpperCase(), 26),
          METRIC_GRID.labelFont,
          METRIC_GRID.labelSize,
          textX,
          baseY - 16,
          TEXT.muted,
        ),
      );

      // Value — ONE font (bold sans) for everything, no serif/mono switching
      curPage(ctx).push(
        textCmd(
          truncate(cell.value, 18),
          METRIC_GRID.valueFont,
          METRIC_GRID.valueSize,
          textX,
          baseY - 32,
          cell.valueColor ?? TEXT.primary,
        ),
      );

      // Sub-label
      if (cell.sub) {
        curPage(ctx).push(
          textCmd(
            truncate(cell.sub, 34),
            METRIC_GRID.subFont,
            METRIC_GRID.subSize,
            textX,
            baseY - 43,
            TEXT.muted,
          ),
        );
      }
    }

    advanceY(ctx, cellH + gap);
  }
}

function renderTable(
  ctx: LayoutCtx,
  block: {
    columns: readonly { label: string; width: number; align?: string }[];
    rows: readonly { cells: readonly string[]; bold?: boolean; accentColor?: RGB }[];
    headerBg?: RGB;
    stripeBg?: RGB;
    marginTop?: number;
  },
) {
  const rowH = TABLE.rowHeight;
  const headerH = TABLE.headerHeight;
  const padH = TABLE.cellPaddingH;
  const headerBg = block.headerBg ?? TABLE.headerBg;
  const stripeBg = block.stripeBg ?? TABLE.stripeBg;

  advanceY(ctx, block.marginTop ?? SPACE.xs);

  // Resolve column positions
  const colPositions = block.columns.map((col, i) => {
    let x = ML;
    for (let j = 0; j < i; j++) x += block.columns[j].width * CW;
    return { x, w: col.width * CW, align: col.align ?? "left" };
  });

  // Header row
  ensureSpace(ctx, headerH + rowH);
  const headerY = ctx.y;
  curPage(ctx).push(rectCmd(ML, headerY - headerH, CW, headerH, headerBg));

  for (let c = 0; c < block.columns.length; c++) {
    const col = block.columns[c];
    const pos = colPositions[c];
    let tx = pos.x + padH;
    if (pos.align === "right") {
      tx = pos.x + pos.w - estimateTextWidth(col.label, TABLE.headerFontSize, TABLE.headerFont) - padH;
    } else if (pos.align === "center") {
      tx = pos.x + (pos.w - estimateTextWidth(col.label, TABLE.headerFontSize, TABLE.headerFont)) / 2;
    }
    // Vertically center text in header
    const headerTextY = headerY - headerH / 2 - TABLE.headerFontSize / 3;
    curPage(ctx).push(
      textCmd(col.label.toUpperCase(), TABLE.headerFont, TABLE.headerFontSize, tx, headerTextY, TABLE.headerFg),
    );
  }
  advanceY(ctx, headerH);

  // Data rows
  for (let r = 0; r < block.rows.length; r++) {
    const row = block.rows[r];
    const font: PdfFontRef = row.bold ? TABLE.cellFontBold : TABLE.cellFont;
    const fontSize = TABLE.fontSize;

    // Compute row height — check if any cell needs wrapping
    let maxLines = 1;
    const cellLines: string[][] = [];
    for (let c = 0; c < Math.min(row.cells.length, block.columns.length); c++) {
      const pos = colPositions[c];
      const availableW = pos.w - padH * 2;
      const maxCharsForCol = Math.max(10, Math.floor(availableW / (fontSize * 0.52)));
      const lines = wrapText(row.cells[c], maxCharsForCol);
      cellLines.push(lines.length > 0 ? lines : [""]);
      maxLines = Math.max(maxLines, lines.length);
    }
    // Cap at 2 lines to prevent runaway rows
    maxLines = Math.min(maxLines, 2);
    const thisRowH = rowH + (maxLines - 1) * (fontSize + 3);

    ensureSpace(ctx, thisRowH);
    const rowY = ctx.y;

    // Stripe background
    if (r % 2 === 1) {
      curPage(ctx).push(rectCmd(ML, rowY - thisRowH, CW, thisRowH, stripeBg));
    }

    // Accent left border
    if (row.accentColor) {
      curPage(ctx).push(rectCmd(ML, rowY - thisRowH, TABLE.accentWidth, thisRowH, row.accentColor));
    }

    // Cell text — vertically centered for single-line, top-aligned for multi-line
    for (let c = 0; c < Math.min(row.cells.length, block.columns.length); c++) {
      const pos = colPositions[c];
      const lines = cellLines[c] ?? [row.cells[c]];

      for (let li = 0; li < Math.min(lines.length, maxLines); li++) {
        let lineText = lines[li];
        // If this is the last visible line and there's more, add ellipsis
        if (li === maxLines - 1 && lines.length > maxLines) {
          lineText = lineText.slice(0, -1) + "\u2026";
        }

        let tx = pos.x + padH;
        if (pos.align === "right") {
          tx = pos.x + pos.w - estimateTextWidth(lineText, fontSize, font) - padH;
        } else if (pos.align === "center") {
          tx = pos.x + (pos.w - estimateTextWidth(lineText, fontSize, font)) / 2;
        }

        // Vertical position: center single lines, stack multi-lines from top
        const lineY = maxLines === 1
          ? rowY - thisRowH / 2 - fontSize / 3
          : rowY - TABLE.cellPaddingV - li * (fontSize + 3) - fontSize;

        curPage(ctx).push(
          textCmd(lineText, font, fontSize, tx, lineY, TEXT.secondary),
        );
      }
    }

    advanceY(ctx, thisRowH);
  }
}

function renderProgressBar(
  ctx: LayoutCtx,
  block: {
    label: string;
    value: string;
    percent: number;
    trackColor?: RGB;
    fillColor?: RGB;
    rangeLabels?: readonly [string, string];
    marginTop?: number;
  },
) {
  const barH = PROGRESS_BAR.trackHeight;
  const totalH = 36 + (block.rangeLabels ? 12 : 0);
  advanceY(ctx, block.marginTop ?? SPACE.xs);
  ensureSpace(ctx, totalH);

  const baseY = ctx.y;
  const fillColor = block.fillColor ?? BRAND.positive;

  // Label + value on same line
  curPage(ctx).push(
    textCmd(block.label, PROGRESS_BAR.labelFont, PROGRESS_BAR.labelSize, ML, baseY, TEXT.primary),
  );
  const valW = estimateTextWidth(block.value, PROGRESS_BAR.labelSize, PROGRESS_BAR.labelFont);
  curPage(ctx).push(
    textCmd(block.value, PROGRESS_BAR.labelFont, PROGRESS_BAR.labelSize, ML + CW - valW, baseY, fillColor),
  );
  advanceY(ctx, 16);

  // Track background
  const trackColor = block.trackColor ?? SURFACE.stripe;
  const trackY = ctx.y;
  curPage(ctx).push(rectCmd(ML, trackY - barH, CW, barH, trackColor));

  // Fill bar
  const clampedPct = Math.max(0, Math.min(1, block.percent / 100));
  const fillW = clampedPct * CW;
  if (fillW > 0) {
    curPage(ctx).push(rectCmd(ML, trackY - barH, fillW, barH, fillColor));
  }

  // Percentage marker
  if (fillW > 2 && fillW < CW - 2) {
    const markerX = ML + fillW;
    const markerY = trackY - barH - 1;
    curPage(ctx).push(circleCmd(markerX, markerY + barH / 2, 3.5, fillColor));
    curPage(ctx).push(circleCmd(markerX, markerY + barH / 2, 2, SURFACE.white));
  }

  advanceY(ctx, barH + 4);

  // Range labels + percentage
  if (block.rangeLabels) {
    const [lo, hi] = block.rangeLabels;
    curPage(ctx).push(textCmd(lo, PROGRESS_BAR.rangeLabelFont, PROGRESS_BAR.rangeLabelSize, ML, ctx.y, TEXT.muted));
    const pctText = `${Math.round(block.percent)}%`;
    const pctW = estimateTextWidth(pctText, PROGRESS_BAR.rangeLabelSize, PROGRESS_BAR.labelFont);
    curPage(ctx).push(
      textCmd(pctText, PROGRESS_BAR.labelFont, PROGRESS_BAR.rangeLabelSize, ML + (CW - pctW) / 2, ctx.y, TEXT.muted),
    );
    const hiW = estimateTextWidth(hi, PROGRESS_BAR.rangeLabelSize);
    curPage(ctx).push(textCmd(hi, PROGRESS_BAR.rangeLabelFont, PROGRESS_BAR.rangeLabelSize, ML + CW - hiW, ctx.y, TEXT.muted));
    advanceY(ctx, SPACE.xs);
  }
}

function renderSeverityCard(
  ctx: LayoutCtx,
  block: {
    severity: "critical" | "warning" | "info";
    title: string;
    body?: string;
    detail?: string;
    action?: string;
    marginTop?: number;
  },
) {
  const accentColor =
    block.severity === "critical"
      ? STATUS.critical
      : block.severity === "warning"
        ? STATUS.warning
        : STATUS.info;

  // Estimate needed height
  const bodyLines = block.body ? wrapText(block.body, 88) : [];
  const detailLines = block.detail ? wrapText(`Context: ${block.detail}`, 92) : [];
  const actionLines = block.action ? wrapText(`Action: ${block.action}`, 92) : [];
  const bodyH = bodyLines.length * SEVERITY_CARD.bodyLineHeight;
  const detailH = detailLines.length * SEVERITY_CARD.detailLineHeight;
  const actionH = actionLines.length * SEVERITY_CARD.bodyLineHeight;
  const cardH = Math.max(28, 16 + bodyH + detailH + actionH + 8);

  advanceY(ctx, block.marginTop ?? SPACE.xs);
  ensureSpace(ctx, cardH);

  const baseY = ctx.y;

  // Card background
  curPage(ctx).push(rectCmd(ML, baseY - cardH, CW, cardH, SURFACE.white));
  // Bottom border
  curPage(ctx).push(lineCmd(ML, baseY - cardH, ML + CW, baseY - cardH, 0.3, SURFACE.border));

  // Accent left border
  curPage(ctx).push(rectCmd(ML, baseY - cardH, SEVERITY_CARD.accentWidth, cardH, accentColor));

  // Severity badge
  const badgeText = block.severity.toUpperCase();
  const badgePair =
    block.severity === "critical" ? BADGE.danger
      : block.severity === "warning" ? BADGE.warning
        : BADGE.positive;
  const badgeW = estimateTextWidth(badgeText, SEVERITY_CARD.badgeSize, SEVERITY_CARD.badgeFont) + 12;
  curPage(ctx).push(rectCmd(ML + CW - badgeW - 8, baseY - 16, badgeW, 14, badgePair.bg));
  curPage(ctx).push(
    textCmd(badgeText, SEVERITY_CARD.badgeFont, SEVERITY_CARD.badgeSize, ML + CW - badgeW - 2, baseY - 13, badgePair.fg),
  );

  // Title — same size as body, just bold
  const textX = ML + 14;
  curPage(ctx).push(textCmd(truncate(block.title, 72), SEVERITY_CARD.titleFont, SEVERITY_CARD.titleSize, textX, baseY - 13, TEXT.primary));
  let lineY = baseY - 26;

  // Body
  for (const line of bodyLines) {
    curPage(ctx).push(textCmd(line, SEVERITY_CARD.bodyFont, SEVERITY_CARD.bodySize, textX, lineY, TEXT.secondary));
    lineY -= SEVERITY_CARD.bodyLineHeight;
  }

  // Detail (muted, smaller)
  for (const line of detailLines) {
    curPage(ctx).push(textCmd(line, SEVERITY_CARD.detailFont, SEVERITY_CARD.detailSize, textX, lineY, TEXT.muted));
    lineY -= SEVERITY_CARD.detailLineHeight;
  }

  // Action (bold, dark green)
  for (const line of actionLines) {
    curPage(ctx).push(textCmd(line, SEVERITY_CARD.actionFont, SEVERITY_CARD.actionSize, textX, lineY, SEVERITY_CARD.actionColor));
    lineY -= SEVERITY_CARD.bodyLineHeight;
  }

  advanceY(ctx, cardH + SPACE.xs);
}

function renderStatusBadge(
  ctx: LayoutCtx,
  label: string,
  color: RGB,
  textColor: RGB | undefined,
  marginTop = SPACE.xs,
) {
  advanceY(ctx, marginTop);
  ensureSpace(ctx, 24);

  // Resolve badge bg/fg pair
  const isGreen = color[1] > 0.5 && color[0] < 0.2;
  const isRed = color[0] > 0.8 && color[1] < 0.4;
  const isAmber = color[0] > 0.8 && color[1] > 0.5 && color[2] < 0.2;

  const pair = isGreen ? BADGE.positive
    : isRed ? BADGE.danger
      : isAmber ? BADGE.warning
        : BADGE.info;

  const fgColor = textColor ?? pair.fg;

  const badgeW = estimateTextWidth(label, STATUS_BADGE.size, STATUS_BADGE.font) + 24;
  const badgeH = STATUS_BADGE.height;
  curPage(ctx).push(rectCmd(ML, ctx.y - badgeH, badgeW, badgeH, pair.bg));
  curPage(ctx).push(textCmd(label, STATUS_BADGE.font, STATUS_BADGE.size, ML + 12, ctx.y - 15, fgColor));

  advanceY(ctx, badgeH + SPACE.xs);
}

function renderSparkline(
  ctx: LayoutCtx,
  block: {
    label: string;
    data: readonly number[];
    color?: RGB;
    height?: number;
    marginTop?: number;
  },
) {
  if (block.data.length < 2) return;

  const sparkH = block.height ?? CHART.defaultHeight;
  const axisW = CHART.axisWidth;
  const chartW = CW - axisW;
  const totalH = sparkH + 24;
  advanceY(ctx, block.marginTop ?? SPACE.xs);
  ensureSpace(ctx, totalH);

  const baseY = ctx.y;
  const chartColor = block.color ?? BRAND.forest900;

  // Label
  curPage(ctx).push(textCmd(block.label, CHART.labelFont, CHART.labelSize, ML, baseY, TEXT.primary));
  advanceY(ctx, 16);

  const chartY = ctx.y;
  const chartLeft = ML + axisW;
  const chartBottom = chartY - sparkH;
  const padding = 6;

  // Background
  curPage(ctx).push(rectCmd(chartLeft, chartBottom, chartW, sparkH, SURFACE.stripe));

  // Normalize data
  const minVal = block.data.length > 0 ? Math.min(...block.data) : 0;
  const maxVal = block.data.length > 0 ? Math.max(...block.data) : 1;
  const range = maxVal - minVal || 1;

  // Horizontal grid lines
  for (let i = 0; i <= 3; i++) {
    const gy = chartBottom + (i / 3) * sparkH;
    curPage(ctx).push(dashedLineCmd(chartLeft, gy, chartLeft + chartW, 0.3, SURFACE.grid));
    const val = minVal + (i / 3) * range;
    curPage(ctx).push(
      textCmd(formatAxisValue(val), CHART.axisFont, CHART.axisSize, ML, gy - 3, TEXT.muted),
    );
  }

  // Data points (safe division: denominator is always >= 1 because of length >= 2 guard)
  const denom = Math.max(1, block.data.length - 1);
  const points = block.data.map((val, i) => ({
    x: chartLeft + padding + (i / denom) * (chartW - padding * 2),
    y: chartBottom + padding + ((val - minVal) / range) * (sparkH - padding * 2),
  }));

  // Area fill under the curve
  curPage(ctx).push(smoothAreaFillCmd(points, chartBottom, chartColor, 0.15));

  // Smooth curve
  curPage(ctx).push(smoothPolylineCmd(points, 1.8, chartColor));

  // Data point markers
  const step = Math.max(1, Math.floor(points.length / 8));
  for (let i = 0; i < points.length; i++) {
    if (i === 0 || i === points.length - 1 || i % step === 0) {
      curPage(ctx).push(circleCmd(points[i].x, points[i].y, 2.2, chartColor));
      curPage(ctx).push(circleCmd(points[i].x, points[i].y, 1.2, SURFACE.white));
    }
  }

  // Last value label
  if (points.length > 0) {
    const lastPt = points[points.length - 1];
    const lastVal = block.data[block.data.length - 1] ?? 0;
    curPage(ctx).push(
      textCmd(formatAxisValue(lastVal), CHART.lastValueFont, CHART.lastValueSize, lastPt.x + 4, lastPt.y - 3, chartColor),
    );
  }

  advanceY(ctx, sparkH + 6);
}

function renderMultiSparkline(
  ctx: LayoutCtx,
  block: {
    label: string;
    series: readonly { label: string; data: readonly number[]; color?: RGB }[];
    height?: number;
    marginTop?: number;
  },
) {
  const usableSeries = block.series.filter((series) => series.data.length >= 2);
  if (usableSeries.length === 0) return;

  const sparkH = block.height ?? CHART.multiHeight;
  const axisW = CHART.axisWidth;
  const chartW = CW - axisW;
  const totalH = sparkH + 36;
  advanceY(ctx, block.marginTop ?? SPACE.xs);
  ensureSpace(ctx, totalH);

  const baseY = ctx.y;

  // Title
  curPage(ctx).push(textCmd(block.label, CHART.labelFont, CHART.labelSize, ML, baseY, TEXT.primary));

  // Legend
  let legendX = ML;
  const legendY = baseY - 14;
  for (const series of usableSeries) {
    const legendColor = series.color ?? BRAND.forest900;
    curPage(ctx).push(lineCmd(legendX, legendY + 3, legendX + 14, legendY + 3, 2, legendColor));
    curPage(ctx).push(circleCmd(legendX + 7, legendY + 3, 2, legendColor));
    legendX += 18;
    curPage(ctx).push(textCmd(series.label, CHART.legendFont, CHART.legendSize, legendX, legendY, TEXT.muted));
    legendX += estimateTextWidth(series.label, CHART.legendSize) + 14;
  }

  advanceY(ctx, 22);
  const chartY = ctx.y;
  const chartLeft = ML + axisW;
  const chartBottom = chartY - sparkH;
  const padding = 6;

  // Background
  curPage(ctx).push(rectCmd(chartLeft, chartBottom, chartW, sparkH, SURFACE.stripe));

  // Shared Y-axis normalization
  const allValues = usableSeries.flatMap((series) => [...series.data]);
  if (allValues.length === 0) return;
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const range = maxVal - minVal || 1;

  // Horizontal grid lines
  for (let i = 0; i <= 3; i++) {
    const gy = chartBottom + (i / 3) * sparkH;
    curPage(ctx).push(dashedLineCmd(chartLeft, gy, chartLeft + chartW, 0.3, SURFACE.grid));
    const val = minVal + (i / 3) * range;
    curPage(ctx).push(
      textCmd(formatAxisValue(val), CHART.axisFont, CHART.axisSize, ML, gy - 3, TEXT.muted),
    );
  }

  // Render each series
  for (let si = 0; si < usableSeries.length; si++) {
    const series = usableSeries[si];
    const color = series.color ?? BRAND.forest900;
    const seriesDenom = Math.max(1, series.data.length - 1);
    const points = series.data.map((value, index) => ({
      x: chartLeft + padding + (index / seriesDenom) * (chartW - padding * 2),
      y: chartBottom + padding + ((value - minVal) / range) * (sparkH - padding * 2),
    }));

    // Area fill for first series only (to avoid overlap clutter)
    if (si === 0) {
      curPage(ctx).push(smoothAreaFillCmd(points, chartBottom, color, 0.15));
    }

    // Smooth curve
    curPage(ctx).push(smoothPolylineCmd(points, 1.6, color));

    // Markers
    const step = Math.max(1, Math.floor(points.length / 6));
    for (let i = 0; i < points.length; i++) {
      if (i === 0 || i === points.length - 1 || i % step === 0) {
        curPage(ctx).push(circleCmd(points[i].x, points[i].y, 2, color));
        curPage(ctx).push(circleCmd(points[i].x, points[i].y, 1, SURFACE.white));
      }
    }

    // Last value label
    if (points.length > 0) {
      const lastPt = points[points.length - 1];
      const lastVal = series.data[series.data.length - 1] ?? 0;
      curPage(ctx).push(
        textCmd(formatAxisValue(lastVal), CHART.lastValueFont, CHART.lastValueSize, lastPt.x + 4, lastPt.y - 3, color),
      );
    }
  }

  advanceY(ctx, sparkH + 6);
}

function renderKeyValue(
  ctx: LayoutCtx,
  pairs: readonly { key: string; value: string; valueColor?: RGB }[],
  columns: 1 | 2 = 1,
  marginTop = SPACE.xs,
) {
  if (pairs.length === 0) return;
  const rowH = KEY_VALUE.rowHeight;
  advanceY(ctx, marginTop);

  if (columns === 1) {
    for (const pair of pairs) {
      ensureSpace(ctx, rowH);
      curPage(ctx).push(textCmd(pair.key, KEY_VALUE.keyFont, KEY_VALUE.keySize, ML, ctx.y, TEXT.muted));
      const valX = ML + KEY_VALUE.keyIndent;
      curPage(ctx).push(
        textCmd(truncate(pair.value, 50), KEY_VALUE.valueFont, KEY_VALUE.valueSize, valX, ctx.y, pair.valueColor ?? TEXT.secondary),
      );
      advanceY(ctx, rowH);
    }
  } else {
    const colW = CW / 2;
    const rows = Math.ceil(pairs.length / 2);
    for (let r = 0; r < rows; r++) {
      ensureSpace(ctx, rowH);
      for (let c = 0; c < 2; c++) {
        const idx = r * 2 + c;
        if (idx >= pairs.length) break;
        const pair = pairs[idx];
        const cx = ML + c * colW;
        curPage(ctx).push(textCmd(pair.key, KEY_VALUE.keyFont, KEY_VALUE.keySize, cx, ctx.y, TEXT.muted));
        curPage(ctx).push(
          textCmd(
            truncate(pair.value, 24),
            KEY_VALUE.valueFont,
            KEY_VALUE.valueSize,
            cx + 80,
            ctx.y,
            pair.valueColor ?? TEXT.secondary,
          ),
        );
      }
      advanceY(ctx, rowH);
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════
   Master block dispatcher
   ═══════════════════════════════════════════════════════════════════ */

function layoutBlock(ctx: LayoutCtx, block: PdfBlock) {
  switch (block.kind) {
    case "text":
      renderTextBlock(ctx, block.style, block.text);
      break;

    case "spacer":
      renderSpacer(ctx, block.height);
      break;

    case "divider":
      renderDivider(ctx, block.color, block.thickness, block.marginTop);
      break;

    case "section-header":
      renderSectionHeader(ctx, block.label, block.meta, block.accentColor, block.marginTop);
      break;

    case "metric-strip":
      renderMetricStrip(ctx, block.cells, block.marginTop);
      break;

    case "metric-grid":
      renderMetricGrid(ctx, block.cells, block.columns, block.marginTop);
      break;

    case "table":
      renderTable(ctx, block);
      break;

    case "progress-bar":
      renderProgressBar(ctx, block);
      break;

    case "severity-card":
      renderSeverityCard(ctx, block);
      break;

    case "status-badge":
      renderStatusBadge(ctx, block.label, block.color, block.textColor, block.marginTop);
      break;

    case "sparkline":
      renderSparkline(ctx, block);
      break;

    case "multi-sparkline":
      renderMultiSparkline(ctx, block);
      break;

    case "key-value":
      renderKeyValue(ctx, block.pairs, block.columns, block.marginTop);
      break;
  }
}

/* ═══════════════════════════════════════════════════════════════════
   Page chrome (header bar, footer, branding)
   ═══════════════════════════════════════════════════════════════════ */

function buildPageChrome(
  author: string | undefined,
  title: string,
  pageNumber: number,
  pageCount: number,
  hasLogo: boolean,
): string[] {
  const cmds: string[] = [
    // Top accent bar
    rectCmd(0, PAGE_HEIGHT - CHROME.topBarHeight, PAGE_WIDTH, CHROME.topBarHeight, CHROME.topBarColor),
    // Header separator line
    lineCmd(ML, CHROME.headerLineY, ML + CW, CHROME.headerLineY, 0.5, BRAND.forest100),
    // Footer separator line
    lineCmd(ML, CHROME.footerLineY, ML + CW, CHROME.footerLineY, 0.5, SURFACE.border),
    // Page number (bottom right)
    textCmd(
      `${pageNumber} / ${pageCount}`,
      CHROME.pageNumFont,
      CHROME.pageNumSize,
      ML + CW - 28,
      32,
      TEXT.muted,
    ),
    // Generator credit (bottom left)
    textCmd("NocPulse", CHROME.wordmarkFont, CHROME.wordmarkSize, ML, 32, BRAND.forest900),
    textCmd("  Confidential", CHROME.confidentialFont, CHROME.confidentialSize, ML + 48, 32, TEXT.muted),
  ];

  // Logo or author name
  if (hasLogo) {
    cmds.push(imageCmd(ML, 764, 100, 16, "ImBrand"));
  } else {
    // Sans bold author name — no serif in reports
    cmds.push(textCmd(author ?? "NocPulse", "F2", 11, ML, 768, BRAND.forest950));
  }

  // Page 2+ title echo (sans, muted — not competing with content)
  if (pageNumber > 1) {
    cmds.push(textCmd(title, CHROME.titleEchoFont, CHROME.titleEchoSize, ML, 748, TEXT.muted));
  }

  return cmds;
}

/* ═══════════════════════════════════════════════════════════════════
   Main layout + document assembly
   ═══════════════════════════════════════════════════════════════════ */

function buildPdfDocument(
  input: PdfRenderInput,
  pageStreams: readonly string[],
): Uint8Array {
  let nextObject = 1;
  const fontRegularObject = nextObject++;  // F1 Helvetica
  const fontBoldObject = nextObject++;     // F2 Helvetica-Bold
  // F3/F4: Embedded Caudex serif — with fallback to Times-Roman if font load fails
  const serifRegular = getSerifRegular();
  const serifBold = getSerifBold();
  let fontSerifObject: number;
  let fontSerifBoldObject: number;
  let serifRegularObjs: PdfFontObjects | null = null;
  let serifBoldObjs: PdfFontObjects | null = null;

  if (serifRegular && serifBold) {
    serifRegularObjs = generatePdfFontObjects(serifRegular, nextObject);
    nextObject += serifRegularObjs.objectCount;
    serifBoldObjs = generatePdfFontObjects(serifBold, nextObject);
    nextObject += serifBoldObjs.objectCount;
    fontSerifObject = serifRegularObjs.fontObjNum;
    fontSerifBoldObject = serifBoldObjs.fontObjNum;
  } else {
    // Fallback to built-in serif fonts if custom fonts failed to load
    fontSerifObject = nextObject++;
    fontSerifBoldObject = nextObject++;
  }
  const fontMonoObject = nextObject++;     // F5 Courier
  const fontMonoBoldObject = nextObject++; // F6 Courier-Bold
  const gsAlphaObject = nextObject++; // Graphics state for area fill opacity
  const logoImage = input.brandLogo ? decodePngLogo(input.brandLogo) : null;
  const logoImageObject = logoImage ? nextObject++ : null;
  const logoMaskObject = logoImage?.alphaHex ? nextObject++ : null;
  const firstContentObject = nextObject;
  const firstPageObject = firstContentObject + pageStreams.length;
  const pagesObject = firstPageObject + pageStreams.length;
  const catalogObject = pagesObject + 1;
  const infoObject = catalogObject + 1;

  const objects: string[] = [];
  objects[fontRegularObject] = [
    `${fontRegularObject} 0 obj`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "endobj",
  ].join("\n");
  objects[fontBoldObject] = [
    `${fontBoldObject} 0 obj`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    "endobj",
  ].join("\n");
  // F3/F4: Embedded Caudex serif or fallback Times-Roman
  if (serifRegularObjs && serifBoldObjs) {
    for (const obj of serifRegularObjs.objects) {
      objects[obj.objNum] = obj.content;
    }
    for (const obj of serifBoldObjs.objects) {
      objects[obj.objNum] = obj.content;
    }
  } else {
    // Fallback: use built-in Times-Roman when custom font embedding fails
    objects[fontSerifObject] = [
      `${fontSerifObject} 0 obj`,
      "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >>",
      "endobj",
    ].join("\n");
    objects[fontSerifBoldObject] = [
      `${fontSerifBoldObject} 0 obj`,
      "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >>",
      "endobj",
    ].join("\n");
  }
  objects[fontMonoObject] = [
    `${fontMonoObject} 0 obj`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>",
    "endobj",
  ].join("\n");
  objects[fontMonoBoldObject] = [
    `${fontMonoBoldObject} 0 obj`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>",
    "endobj",
  ].join("\n");

  // Graphics state for semi-transparent area fills (0.15 opacity)
  objects[gsAlphaObject] = [
    `${gsAlphaObject} 0 obj`,
    "<< /Type /ExtGState /ca 0.15 >>",
    "endobj",
  ].join("\n");

  if (logoImage && logoImageObject) {
    if (logoMaskObject && logoImage.alphaHex) {
      objects[logoMaskObject] = [
        `${logoMaskObject} 0 obj`,
        "<<",
        "/Type /XObject",
        "/Subtype /Image",
        `/Width ${logoImage.width}`,
        `/Height ${logoImage.height}`,
        "/ColorSpace /DeviceGray",
        "/BitsPerComponent 8",
        "/Filter [/ASCIIHexDecode /FlateDecode]",
        `/Length ${Buffer.byteLength(logoImage.alphaHex, "utf8")}`,
        ">>",
        "stream",
        logoImage.alphaHex,
        "endstream",
        "endobj",
      ].join("\n");
    }

    objects[logoImageObject] = [
      `${logoImageObject} 0 obj`,
      "<<",
      "/Type /XObject",
      "/Subtype /Image",
      `/Width ${logoImage.width}`,
      `/Height ${logoImage.height}`,
      "/ColorSpace /DeviceRGB",
      "/BitsPerComponent 8",
      "/Filter [/ASCIIHexDecode /FlateDecode]",
      logoMaskObject ? `/SMask ${logoMaskObject} 0 R` : "",
      `/Length ${Buffer.byteLength(logoImage.rgbHex, "utf8")}`,
      ">>",
      "stream",
      logoImage.rgbHex,
      "endstream",
      "endobj",
    ].filter(Boolean).join("\n");
  }

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
    const xObjectSection = logoImageObject
      ? ` /XObject << /ImBrand ${logoImageObject} 0 R >>`
      : "";
    objects[objectNumber] = [
      `${objectNumber} 0 obj`,
      "<<",
      "/Type /Page",
      `/Parent ${pagesObject} 0 R`,
      `/MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}]`,
      `/Resources << /Font << /F1 ${fontRegularObject} 0 R /F2 ${fontBoldObject} 0 R /F3 ${fontSerifObject} 0 R /F4 ${fontSerifBoldObject} 0 R /F5 ${fontMonoObject} 0 R /F6 ${fontMonoBoldObject} 0 R >> /ExtGState << /GS1 ${gsAlphaObject} 0 R >>${xObjectSection} >>`,
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

export function renderPdfDocument(
  input: PdfRenderInput,
): PdfBinaryRenderResult {
  // Layout all blocks into pages of draw commands
  const ctx: LayoutCtx = {
    pages: [[]],
    pageIndex: 0,
    y: PAGE_TOP,
  };

  for (const block of input.blocks) {
    layoutBlock(ctx, block);
  }

  // Build page streams with chrome
  const pageStreams = ctx.pages.map((cmds, index) => {
    const chrome = buildPageChrome(
      input.author,
      input.title,
      index + 1,
      ctx.pages.length,
      Boolean(input.brandLogo),
    );
    return [...chrome, ...cmds].join("\n");
  });

  const bytes = buildPdfDocument(input, pageStreams);
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  return {
    metadata: {
      artifactKey: input.artifactKey,
      pageCount: ctx.pages.length,
      byteSize: bytes.byteLength,
      sha256,
    },
    bytes,
  };
}
