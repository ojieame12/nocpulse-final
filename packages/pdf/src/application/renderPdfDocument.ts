import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { deflateSync, inflateSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  PdfBrandLogo,
  PdfBinaryRenderResult,
  PdfBlock,
  PdfRenderInput,
  PdfTextStyle,
  RGB,
} from "../contracts/PdfRender";
import { parseTTF, generatePdfFontObjects, type EmbeddedFont } from "./ttfEmbed";

/* ═══════════════════════════════════════════════════════════════════
   NocPulse PDF Renderer — Rich visual layout engine
   ═══════════════════════════════════════════════════════════════════ */

/* ── Embedded fonts ──
   Load Playfair Display TTF files for the editorial serif role.
   These replace Times-Roman/Times-Bold (F3/F4) with a real
   high-contrast display serif that matches the P22 Mackinac design intent.
*/
const FONTS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "fonts");

let _serifRegular: EmbeddedFont | null = null;
let _serifBold: EmbeddedFont | null = null;

function getSerifRegular(): EmbeddedFont {
  if (!_serifRegular) {
    _serifRegular = parseTTF(readFileSync(join(FONTS_DIR, "PlayfairDisplay-Regular.ttf")));
  }
  return _serifRegular;
}
function getSerifBold(): EmbeddedFont {
  if (!_serifBold) {
    _serifBold = parseTTF(readFileSync(join(FONTS_DIR, "PlayfairDisplay-Bold.ttf")));
  }
  return _serifBold;
}

/* ── Font roles (maps to design system) ──
   F1 = Helvetica              → body/UI (Sintony stand-in)
   F2 = Helvetica-Bold         → body/UI bold
   F3 = Playfair Display       → editorial serif (P22 Mackinac replacement)
   F4 = Playfair Display Bold  → editorial serif bold
   F5 = Courier                → data/mono (IBM Plex Mono stand-in)
   F6 = Courier-Bold           → data/mono bold
*/
type PdfFontRef = "F1" | "F2" | "F3" | "F4" | "F5" | "F6";

/* ── Constants ── */

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const ML = 48; // margin-left (aligned with design system 48px panel top padding)
const MR = 48; // margin-right
const CW = PAGE_WIDTH - ML - MR; // content width = 516
const PAGE_TOP = 730;
const PAGE_BOTTOM = 56;

/* ── Spacing scale (from design system --space-* tokens) ── */
const SP_XS = 4;
const SP_SM = 8;
const SP_MD = 12;
const SP_LG = 16;
const SP_XL = 24; // section gap — the design system's key rhythm
const SP_2XL = 32;

/* ── Brand colors (from design system tokens) ── */

const BRAND_GREEN: RGB = [0.0, 0.278, 0.145]; // #004726 (forest-900)
const BRAND_GREEN_DARK: RGB = [0.0, 0.165, 0.082]; // #002a15 (forest-950)
const BRAND_GREEN_LIGHT: RGB = [0.863, 0.941, 0.882]; // #dcf0e1 (forest-100)
const BRAND_GREEN_SOFT: RGB = [0.086, 0.639, 0.29]; // #16a34a (status-positive)

/* ── Text colors (from design system) ── */
const TEXT_PRIMARY: RGB = [0.067, 0.067, 0.067]; // #111111
const TEXT_BODY: RGB = [0.278, 0.298, 0.329]; // #474c54
const TEXT_SECONDARY: RGB = [0.420, 0.443, 0.502]; // #6b7280
const TEXT_MUTED: RGB = [0.541, 0.561, 0.596]; // #8a8f98
const TEXT_LIGHT: RGB = [0.667, 0.682, 0.706]; // #aaaea

/* ── Legacy aliases (used by report builders) ── */
const TEXT_DARK = TEXT_PRIMARY;

/* ── Status colors (semantic — from design system) ── */
const SEV_CRITICAL: RGB = [0.937, 0.267, 0.267]; // #ef4444
const SEV_WARNING: RGB = [0.961, 0.620, 0.043]; // #f59e0b
const SEV_INFO: RGB = [0.086, 0.639, 0.290]; // #16a34a

/* ── Status badge backgrounds ── */
const BADGE_BG_POSITIVE: RGB = [0.863, 0.988, 0.906]; // #dcfce7
const BADGE_BG_WARNING: RGB = [0.996, 0.953, 0.780]; // #fef3c7
const BADGE_BG_DANGER: RGB = [0.996, 0.886, 0.886]; // #fee2e2
const BADGE_BG_INFO: RGB = [0.859, 0.918, 0.996]; // #dbeafe
const BADGE_TEXT_POSITIVE: RGB = [0.0, 0.278, 0.149]; // #004726
const BADGE_TEXT_WARNING: RGB = [0.573, 0.251, 0.055]; // #92400e
const BADGE_TEXT_DANGER: RGB = [0.600, 0.106, 0.106]; // #991b1b
const BADGE_TEXT_INFO: RGB = [0.118, 0.251, 0.686]; // #1e40af

/* ── Surface colors ── */
const BG_STRIPE: RGB = [0.957, 0.965, 0.957]; // light gray-green chart bg
const BG_SECTION: RGB = [0.973, 0.973, 0.976]; // #f8f8f9 slate-50 section bg
const BORDER_LIGHT: RGB = [0.902, 0.918, 0.914];
const WHITE: RGB = [1, 1, 1];

/* ── Text style presets (mapped to design system type scale) ── */

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
    font: "F4", // Serif bold — P22 Mackinac role (hero display)
    fontSize: 22, // --text-xl
    lineHeight: 26, // --leading-tight (1.2)
    marginTop: 0,
    maxChars: 40,
    color: BRAND_GREEN_DARK,
  },
  heading: {
    font: "F2", // Sans bold — Sintony role
    fontSize: 14, // --text-base
    lineHeight: 20, // --leading-snug (1.3)
    marginTop: SP_LG,
    maxChars: 66,
    color: TEXT_PRIMARY,
  },
  subheading: {
    font: "F1", // Sans regular
    fontSize: 13, // --text-sm
    lineHeight: 18, // --leading-snug
    marginTop: SP_SM,
    maxChars: 76,
    color: TEXT_BODY,
  },
  body: {
    font: "F1",
    fontSize: 10.5,
    lineHeight: 15, // --leading-normal (1.5 × 10)
    marginTop: SP_XS,
    maxChars: 90,
    color: TEXT_BODY,
  },
  caption: {
    font: "F1",
    fontSize: 9,
    lineHeight: 13, // --leading-normal
    marginTop: 0,
    maxChars: 100,
    color: TEXT_MUTED,
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
      if (code > 0x7E && code < 0xA0) {
        // Control range — skip or replace
        result += " ";
      } else if (code <= 0xFF) {
        // Direct WinAnsi range
        result += ch;
      } else {
        // Unmapped Unicode — replace with placeholder
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
  if (font === "F3") return getSerifRegular().measureText(text, fontSize);
  if (font === "F4") return getSerifBold().measureText(text, fontSize);
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
  color: RGB = BORDER_LIGHT,
  thickness = 0.5,
  marginTop = 8,
) {
  advanceY(ctx, marginTop);
  ensureSpace(ctx, 2);
  curPage(ctx).push(
    lineCmd(ML, ctx.y, ML + CW, ctx.y, thickness, color),
  );
  advanceY(ctx, 6);
}

function renderSectionHeader(
  ctx: LayoutCtx,
  label: string,
  meta: string | undefined,
  accentColor: RGB = BRAND_GREEN,
  marginTop = SP_XL,
) {
  advanceY(ctx, marginTop);
  ensureSpace(ctx, 28);

  // Accent rule (1.5pt — refined, not heavy)
  curPage(ctx).push(lineCmd(ML, ctx.y, ML + CW, ctx.y, 1.5, accentColor));
  advanceY(ctx, SP_MD);

  // Label — uppercase, small, tracked (design system section label pattern)
  // PDF doesn't have letter-spacing, so we space chars manually for the editorial look
  const upperLabel = label.toUpperCase();
  curPage(ctx).push(
    textCmd(upperLabel, "F2", 9, ML, ctx.y, accentColor),
  );

  // Right-aligned meta in lighter weight
  if (meta) {
    const metaW = estimateTextWidth(meta, 8.5);
    curPage(ctx).push(
      textCmd(meta, "F3", 8.5, ML + CW - metaW, ctx.y, TEXT_SECONDARY),
    );
  }

  advanceY(ctx, SP_LG);
}

function renderMetricStrip(
  ctx: LayoutCtx,
  cells: readonly { label: string; value: string; valueColor?: RGB }[],
  marginTop = 8,
) {
  if (cells.length === 0) return;
  const stripH = 44;
  advanceY(ctx, marginTop);
  ensureSpace(ctx, stripH);

  const cellW = CW / cells.length;
  const baseY = ctx.y;

  // Background
  curPage(ctx).push(rectCmd(ML, baseY - stripH, CW, stripH, BG_STRIPE));

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const cx = ML + i * cellW;

    // Vertical separator (skip first)
    if (i > 0) {
      curPage(ctx).push(
        lineCmd(cx, baseY - 6, cx, baseY - stripH + 6, 0.5, BORDER_LIGHT),
      );
    }

    // Label (uppercase, tiny)
    curPage(ctx).push(
      textCmd(
        truncate(cell.label.toUpperCase(), 18),
        "F2",
        7,
        cx + 8,
        baseY - 14,
        TEXT_MUTED,
      ),
    );

    // Value (bold, prominent)
    curPage(ctx).push(
      textCmd(
        truncate(cell.value, 14),
        "F2",
        14,
        cx + 8,
        baseY - 32,
        cell.valueColor ?? TEXT_DARK,
      ),
    );
  }

  advanceY(ctx, stripH + 4);
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
  marginTop = 6,
) {
  if (cells.length === 0) return;
  const gap = 8;
  const cellW = (CW - gap * (columns - 1)) / columns;
  const cellH = 48;
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

      // Card background (white card on light surface)
      curPage(ctx).push(rectCmd(cx, baseY - cellH, cellW, cellH, WHITE));
      // Subtle border
      curPage(ctx).push(lineCmd(cx, baseY - cellH, cx + cellW, baseY - cellH, 0.3, BORDER_LIGHT));

      // Optional accent left border
      if (cell.accentColor) {
        curPage(ctx).push(
          rectCmd(cx, baseY - cellH, 3, cellH, cell.accentColor),
        );
      }

      const textX = cx + (cell.accentColor ? 12 : 10);

      // Label (design system: Sintony 9px 700 uppercase, letter-spacing)
      curPage(ctx).push(
        textCmd(
          truncate(cell.label.toUpperCase(), 26),
          "F2",
          7.5,
          textX,
          baseY - 14,
          TEXT_MUTED,
        ),
      );

      // Value — use serif for hero feel (P22 Mackinac role)
      const isNumeric = /^[\d.\-%°+,/kPa mhC]+$/.test(cell.value.trim());
      curPage(ctx).push(
        textCmd(
          truncate(cell.value, 18),
          isNumeric ? "F5" : "F4", // mono for numbers, serif for text
          isNumeric ? 14 : 13,
          textX,
          baseY - 30,
          cell.valueColor ?? TEXT_PRIMARY,
        ),
      );

      // Sub
      if (cell.sub) {
        curPage(ctx).push(
          textCmd(
            truncate(cell.sub, 30),
            "F1",
            7.5,
            textX,
            baseY - 40,
            TEXT_LIGHT,
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
  const rowH = 16;
  const headerH = 20;
  const headerBg = block.headerBg ?? BRAND_GREEN;
  const stripeBg = block.stripeBg ?? BG_STRIPE;

  advanceY(ctx, block.marginTop ?? 6);

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
    let tx = pos.x + 6;
    if (pos.align === "right") {
      tx = pos.x + pos.w - estimateTextWidth(col.label, 8, "F2") - 6;
    } else if (pos.align === "center") {
      tx = pos.x + (pos.w - estimateTextWidth(col.label, 8, "F2")) / 2;
    }
    curPage(ctx).push(
      textCmd(col.label.toUpperCase(), "F2", 8, tx, headerY - 14, WHITE),
    );
  }
  advanceY(ctx, headerH);

  // Data rows
  for (let r = 0; r < block.rows.length; r++) {
    ensureSpace(ctx, rowH);
    const rowY = ctx.y;
    const row = block.rows[r];

    // Stripe background
    if (r % 2 === 1) {
      curPage(ctx).push(rectCmd(ML, rowY - rowH, CW, rowH, stripeBg));
    }

    // Accent left border
    if (row.accentColor) {
      curPage(ctx).push(rectCmd(ML, rowY - rowH, 2.5, rowH, row.accentColor));
    }

    // Cell text
    for (let c = 0; c < Math.min(row.cells.length, block.columns.length); c++) {
      const pos = colPositions[c];
      const cellText = row.cells[c];
      const font: PdfFontRef = row.bold ? "F2" : "F1";
      const fontSize = 9;
      let tx = pos.x + 6;
      if (pos.align === "right") {
        tx = pos.x + pos.w - estimateTextWidth(cellText, fontSize, row.bold ? "F2" : "F1") - 6;
      } else if (pos.align === "center") {
        tx = pos.x + (pos.w - estimateTextWidth(cellText, fontSize, row.bold ? "F2" : "F1")) / 2;
      }
      curPage(ctx).push(
        textCmd(truncate(cellText, 40), font, fontSize, tx, rowY - 12, TEXT_BODY),
      );
    }

    advanceY(ctx, rowH);
  }

  advanceY(ctx, 4);
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
  const barH = 8;
  const totalH = 36 + (block.rangeLabels ? 12 : 0);
  advanceY(ctx, block.marginTop ?? 6);
  ensureSpace(ctx, totalH);

  const baseY = ctx.y;
  const fillColor = block.fillColor ?? BRAND_GREEN;

  // Label + value on same line
  curPage(ctx).push(
    textCmd(block.label, "F2", 9, ML, baseY, TEXT_DARK),
  );
  const valW = estimateTextWidth(block.value, 9, "F2");
  curPage(ctx).push(
    textCmd(block.value, "F2", 9, ML + CW - valW, baseY, fillColor),
  );
  advanceY(ctx, 16);

  // Track background (light rounded rectangle via overlapping rects)
  const trackColor = block.trackColor ?? ([0.93, 0.94, 0.93] as RGB);
  const trackY = ctx.y;
  curPage(ctx).push(rectCmd(ML, trackY - barH, CW, barH, trackColor));

  // Fill bar
  const clampedPct = Math.max(0, Math.min(1, block.percent / 100));
  const fillW = clampedPct * CW;
  if (fillW > 0) {
    curPage(ctx).push(rectCmd(ML, trackY - barH, fillW, barH, fillColor));
  }

  // Percentage marker (small triangle/dot at the fill edge)
  if (fillW > 2 && fillW < CW - 2) {
    const markerX = ML + fillW;
    const markerY = trackY - barH - 1;
    curPage(ctx).push(circleCmd(markerX, markerY + barH / 2, 3.5, fillColor));
    curPage(ctx).push(circleCmd(markerX, markerY + barH / 2, 2, WHITE));
  }

  advanceY(ctx, barH + 4);

  // Range labels + percentage
  if (block.rangeLabels) {
    const [lo, hi] = block.rangeLabels;
    curPage(ctx).push(textCmd(lo, "F1", 7, ML, ctx.y, TEXT_LIGHT));
    const pctText = `${Math.round(block.percent)}%`;
    const pctW = estimateTextWidth(pctText, 7, "F2");
    curPage(ctx).push(
      textCmd(pctText, "F2", 7, ML + (CW - pctW) / 2, ctx.y, TEXT_MUTED),
    );
    const hiW = estimateTextWidth(hi, 7);
    curPage(ctx).push(textCmd(hi, "F1", 7, ML + CW - hiW, ctx.y, TEXT_LIGHT));
    advanceY(ctx, 12);
  }

  advanceY(ctx, 4);
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
      ? SEV_CRITICAL
      : block.severity === "warning"
        ? SEV_WARNING
        : SEV_INFO;

  // Estimate needed height
  const bodyLines = block.body ? wrapText(block.body, 88) : [];
  const detailLines = block.detail ? wrapText(`Context: ${block.detail}`, 88) : [];
  const actionLines = block.action ? wrapText(`Action: ${block.action}`, 88) : [];
  const lineCount = 1 + bodyLines.length + detailLines.length + actionLines.length;
  const cardH = Math.max(28, 16 + lineCount * 12 + 4);

  advanceY(ctx, block.marginTop ?? 6);
  ensureSpace(ctx, cardH);

  const baseY = ctx.y;

  // Card background (white card)
  curPage(ctx).push(rectCmd(ML, baseY - cardH, CW, cardH, WHITE));
  // Bottom border
  curPage(ctx).push(lineCmd(ML, baseY - cardH, ML + CW, baseY - cardH, 0.3, BORDER_LIGHT));

  // Accent left border (3px wide)
  curPage(ctx).push(rectCmd(ML, baseY - cardH, 3, cardH, accentColor));

  // Severity badge (design system: status badge pairs)
  const badgeText = block.severity.toUpperCase();
  const badgeBg =
    block.severity === "critical" ? BADGE_BG_DANGER
      : block.severity === "warning" ? BADGE_BG_WARNING
        : BADGE_BG_POSITIVE;
  const badgeFg =
    block.severity === "critical" ? BADGE_TEXT_DANGER
      : block.severity === "warning" ? BADGE_TEXT_WARNING
        : BADGE_TEXT_POSITIVE;
  const badgeW = estimateTextWidth(badgeText, 7, "F2") + 12;
  curPage(ctx).push(rectCmd(ML + CW - badgeW - 8, baseY - 16, badgeW, 14, badgeBg));
  curPage(ctx).push(
    textCmd(badgeText, "F2", 7, ML + CW - badgeW - 2, baseY - 13, badgeFg),
  );

  // Title
  const textX = ML + 12;
  curPage(ctx).push(textCmd(truncate(block.title, 68), "F2", 10.5, textX, baseY - 13, TEXT_PRIMARY));
  let lineY = baseY - 28;

  // Body
  for (const line of bodyLines) {
    curPage(ctx).push(textCmd(line, "F1", 9.5, textX, lineY, TEXT_BODY));
    lineY -= 13;
  }

  // Detail (muted)
  for (const line of detailLines) {
    curPage(ctx).push(textCmd(line, "F3", 8.5, textX, lineY, TEXT_SECONDARY));
    lineY -= 12;
  }

  // Action (bold, branded green)
  for (const line of actionLines) {
    curPage(ctx).push(textCmd(line, "F2", 9, textX, lineY, BRAND_GREEN));
    lineY -= 12;
  }

  advanceY(ctx, cardH + SP_SM);
}

function renderStatusBadge(
  ctx: LayoutCtx,
  label: string,
  color: RGB,
  textColor: RGB | undefined,
  marginTop = SP_SM,
) {
  advanceY(ctx, marginTop);
  ensureSpace(ctx, 24);

  // Resolve badge bg/fg pair from design system
  const isGreen = color[1] > 0.5 && color[0] < 0.2;
  const isRed = color[0] > 0.8 && color[1] < 0.4;
  const isAmber = color[0] > 0.8 && color[1] > 0.5 && color[2] < 0.2;

  const bgColor = isGreen ? BADGE_BG_POSITIVE
    : isRed ? BADGE_BG_DANGER
      : isAmber ? BADGE_BG_WARNING
        : BADGE_BG_INFO;

  const fgColor = textColor ?? (
    isGreen ? BADGE_TEXT_POSITIVE
      : isRed ? BADGE_TEXT_DANGER
        : isAmber ? BADGE_TEXT_WARNING
          : BADGE_TEXT_INFO
  );

  const badgeW = estimateTextWidth(label, 11, "F2") + 24;
  const badgeH = 22;
  // Filled rounded rectangle (using rect — PDF rounded rects need more work)
  curPage(ctx).push(rectCmd(ML, ctx.y - badgeH, badgeW, badgeH, bgColor));
  curPage(ctx).push(textCmd(label, "F2", 11, ML + 12, ctx.y - 15, fgColor));

  advanceY(ctx, badgeH + SP_SM);
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

  const sparkH = block.height ?? 48;
  const axisW = 32; // space for Y-axis labels
  const chartW = CW - axisW;
  const totalH = sparkH + 24;
  advanceY(ctx, block.marginTop ?? 8);
  ensureSpace(ctx, totalH);

  const baseY = ctx.y;
  const chartColor = block.color ?? BRAND_GREEN;

  // Label
  curPage(ctx).push(textCmd(block.label, "F2", 9, ML, baseY, TEXT_DARK));
  advanceY(ctx, 16);

  const chartY = ctx.y;
  const chartLeft = ML + axisW;
  const chartBottom = chartY - sparkH;
  const padding = 6;

  // Background
  curPage(ctx).push(rectCmd(chartLeft, chartBottom, chartW, sparkH, BG_STRIPE));

  // Normalize data
  const minVal = Math.min(...block.data);
  const maxVal = Math.max(...block.data);
  const range = maxVal - minVal || 1;

  // Horizontal grid lines (4 lines including top and bottom)
  const GRID_COLOR: RGB = [0.88, 0.90, 0.89];
  for (let i = 0; i <= 3; i++) {
    const gy = chartBottom + (i / 3) * sparkH;
    curPage(ctx).push(dashedLineCmd(chartLeft, gy, chartLeft + chartW, 0.3, GRID_COLOR));
    // Y-axis labels
    const val = minVal + (i / 3) * range;
    curPage(ctx).push(
      textCmd(formatAxisValue(val), "F1", 7, ML, gy - 3, TEXT_LIGHT),
    );
  }

  // Data points
  const points = block.data.map((val, i) => ({
    x: chartLeft + padding + (i / (block.data.length - 1)) * (chartW - padding * 2),
    y: chartBottom + padding + ((val - minVal) / range) * (sparkH - padding * 2),
  }));

  // Area fill under the curve
  curPage(ctx).push(smoothAreaFillCmd(points, chartBottom, chartColor, 0.15));

  // Smooth curve
  curPage(ctx).push(smoothPolylineCmd(points, 1.8, chartColor));

  // Data point markers (at regular intervals, always show first and last)
  const step = Math.max(1, Math.floor(points.length / 8));
  for (let i = 0; i < points.length; i++) {
    if (i === 0 || i === points.length - 1 || i % step === 0) {
      curPage(ctx).push(circleCmd(points[i].x, points[i].y, 2.2, chartColor));
      // White inner circle for hollow dot effect
      curPage(ctx).push(circleCmd(points[i].x, points[i].y, 1.2, WHITE));
    }
  }

  // Last value label
  const lastPt = points[points.length - 1];
  const lastVal = block.data[block.data.length - 1];
  curPage(ctx).push(
    textCmd(formatAxisValue(lastVal), "F2", 8, lastPt.x + 4, lastPt.y - 3, chartColor),
  );

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

  const sparkH = block.height ?? 56;
  const axisW = 32;
  const chartW = CW - axisW;
  const totalH = sparkH + 36;
  advanceY(ctx, block.marginTop ?? 8);
  ensureSpace(ctx, totalH);

  const baseY = ctx.y;

  // Title
  curPage(ctx).push(textCmd(block.label, "F2", 9, ML, baseY, TEXT_DARK));

  // Legend with colored line segments + dots
  let legendX = ML;
  const legendY = baseY - 14;
  for (const series of usableSeries) {
    const legendColor = series.color ?? BRAND_GREEN;
    // Small colored line segment
    curPage(ctx).push(lineCmd(legendX, legendY + 3, legendX + 14, legendY + 3, 2, legendColor));
    curPage(ctx).push(circleCmd(legendX + 7, legendY + 3, 2, legendColor));
    legendX += 18;
    // Label text
    curPage(ctx).push(textCmd(series.label, "F1", 8, legendX, legendY, TEXT_MUTED));
    legendX += estimateTextWidth(series.label, 8) + 14;
  }

  advanceY(ctx, 22);
  const chartY = ctx.y;
  const chartLeft = ML + axisW;
  const chartBottom = chartY - sparkH;
  const padding = 6;

  // Background
  curPage(ctx).push(rectCmd(chartLeft, chartBottom, chartW, sparkH, BG_STRIPE));

  // Shared Y-axis normalization
  const allValues = usableSeries.flatMap((series) => [...series.data]);
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const range = maxVal - minVal || 1;

  // Horizontal grid lines
  const GRID_COLOR: RGB = [0.88, 0.90, 0.89];
  for (let i = 0; i <= 3; i++) {
    const gy = chartBottom + (i / 3) * sparkH;
    curPage(ctx).push(dashedLineCmd(chartLeft, gy, chartLeft + chartW, 0.3, GRID_COLOR));
    const val = minVal + (i / 3) * range;
    curPage(ctx).push(
      textCmd(formatAxisValue(val), "F1", 7, ML, gy - 3, TEXT_LIGHT),
    );
  }

  // Render each series
  for (let si = 0; si < usableSeries.length; si++) {
    const series = usableSeries[si];
    const color = series.color ?? BRAND_GREEN;
    const points = series.data.map((value, index) => ({
      x: chartLeft + padding + (index / (series.data.length - 1)) * (chartW - padding * 2),
      y: chartBottom + padding + ((value - minVal) / range) * (sparkH - padding * 2),
    }));

    // Area fill for first series only (to avoid overlap clutter)
    if (si === 0) {
      curPage(ctx).push(smoothAreaFillCmd(points, chartBottom, color, 0.15));
    }

    // Smooth curve
    curPage(ctx).push(smoothPolylineCmd(points, 1.6, color));

    // Markers at endpoints and regular intervals
    const step = Math.max(1, Math.floor(points.length / 6));
    for (let i = 0; i < points.length; i++) {
      if (i === 0 || i === points.length - 1 || i % step === 0) {
        curPage(ctx).push(circleCmd(points[i].x, points[i].y, 2, color));
        curPage(ctx).push(circleCmd(points[i].x, points[i].y, 1, WHITE));
      }
    }

    // Last value label
    const lastPt = points[points.length - 1];
    const lastVal = series.data[series.data.length - 1];
    curPage(ctx).push(
      textCmd(formatAxisValue(lastVal), "F2", 7, lastPt.x + 4, lastPt.y - 3, color),
    );
  }

  advanceY(ctx, sparkH + 6);
}

function renderKeyValue(
  ctx: LayoutCtx,
  pairs: readonly { key: string; value: string; valueColor?: RGB }[],
  columns: 1 | 2 = 1,
  marginTop = 4,
) {
  if (pairs.length === 0) return;
  const rowH = 14;
  advanceY(ctx, marginTop);

  if (columns === 1) {
    for (const pair of pairs) {
      ensureSpace(ctx, rowH);
      curPage(ctx).push(textCmd(pair.key, "F2", 9, ML, ctx.y, TEXT_MUTED));
      const valX = ML + 160;
      curPage(ctx).push(
        textCmd(truncate(pair.value, 50), "F1", 9, valX, ctx.y, pair.valueColor ?? TEXT_BODY),
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
        curPage(ctx).push(textCmd(pair.key, "F2", 9, cx, ctx.y, TEXT_MUTED));
        curPage(ctx).push(
          textCmd(
            truncate(pair.value, 24),
            "F1",
            9,
            cx + 80,
            ctx.y,
            pair.valueColor ?? TEXT_BODY,
          ),
        );
      }
      advanceY(ctx, rowH);
    }
  }

  advanceY(ctx, 2);
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
    // Top accent bar (forest green, 6pt — thinner, more refined)
    rectCmd(0, PAGE_HEIGHT - 6, PAGE_WIDTH, 6, BRAND_GREEN_DARK),
    // Header separator line
    lineCmd(ML, 756, ML + CW, 756, 0.5, BRAND_GREEN_LIGHT),
    // Footer separator line
    lineCmd(ML, 42, ML + CW, 42, 0.5, BORDER_LIGHT),
    // Page number (bottom right, mono font)
    textCmd(
      `${pageNumber} / ${pageCount}`,
      "F5",
      7.5,
      ML + CW - 28,
      32,
      TEXT_MUTED,
    ),
    // Generator credit (bottom left)
    textCmd("NocPulse", "F2", 7.5, ML, 32, BRAND_GREEN),
    textCmd("  Confidential", "F1", 7, ML + 48, 32, TEXT_LIGHT),
  ];

  // Logo or author name
  if (hasLogo) {
    // Larger logo (100 × 16pt)
    cmds.push(imageCmd(ML, 764, 100, 16, "ImBrand"));
  } else {
    // Serif author name for editorial feel
    cmds.push(textCmd(author ?? "NocPulse", "F4", 11, ML, 768, BRAND_GREEN_DARK));
  }

  // Page 2+ title echo (serif italic feel — lighter, not competing with content)
  if (pageNumber > 1) {
    cmds.push(textCmd(title, "F3", 9.5, ML, 748, TEXT_SECONDARY));
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
  // F3/F4: Embedded Playfair Display — reserve object numbers
  const serifRegular = getSerifRegular();
  const serifBold = getSerifBold();
  const serifRegularObjs = generatePdfFontObjects(serifRegular, nextObject);
  nextObject += serifRegularObjs.objectCount;
  const serifBoldObjs = generatePdfFontObjects(serifBold, nextObject);
  nextObject += serifBoldObjs.objectCount;
  const fontSerifObject = serifRegularObjs.fontObjNum;
  const fontSerifBoldObject = serifBoldObjs.fontObjNum;
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
  // F3: Playfair Display Regular (embedded TrueType)
  for (const obj of serifRegularObjs.objects) {
    objects[obj.objNum] = obj.content;
  }
  // F4: Playfair Display Bold (embedded TrueType)
  for (const obj of serifBoldObjs.objects) {
    objects[obj.objNum] = obj.content;
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
