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

/* ═══════════════════════════════════════════════════════════════════
   NocPulse PDF Renderer — Rich visual layout engine
   ═══════════════════════════════════════════════════════════════════ */

type PdfFontRef = "F1" | "F2";

/* ── Constants ── */

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const ML = 54; // margin-left
const MR = 54; // margin-right
const CW = PAGE_WIDTH - ML - MR; // content width = 504
const PAGE_TOP = 736;
const PAGE_BOTTOM = 62;

/* ── Brand colors ── */

const BRAND_GREEN: RGB = [0.08, 0.24, 0.17]; // NocPulse forest green
const BRAND_GREEN_LIGHT: RGB = [0.85, 0.93, 0.87]; // light green tint
const TEXT_DARK: RGB = [0.12, 0.12, 0.12];
const TEXT_BODY: RGB = [0.14, 0.14, 0.14];
const TEXT_MUTED: RGB = [0.4, 0.4, 0.4];
const TEXT_LIGHT: RGB = [0.55, 0.55, 0.55];
const SEV_CRITICAL: RGB = [0.93, 0.27, 0.27]; // #ef4444
const SEV_WARNING: RGB = [0.96, 0.62, 0.04]; // #f59e0b
const SEV_INFO: RGB = [0.09, 0.64, 0.29]; // #16a34a
const BG_STRIPE: RGB = [0.97, 0.98, 0.97]; // very light gray-green
const BORDER_LIGHT: RGB = [0.90, 0.92, 0.91];
const WHITE: RGB = [1, 1, 1];

/* ── Text style presets ── */

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
    font: "F2",
    fontSize: 20,
    lineHeight: 28,
    marginTop: 0,
    maxChars: 44,
    color: BRAND_GREEN,
  },
  heading: {
    font: "F2",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 14,
    maxChars: 70,
    color: TEXT_DARK,
  },
  subheading: {
    font: "F2",
    fontSize: 10.5,
    lineHeight: 15,
    marginTop: 8,
    maxChars: 82,
    color: [0.18, 0.18, 0.18],
  },
  body: {
    font: "F1",
    fontSize: 10,
    lineHeight: 13.5,
    marginTop: 2,
    maxChars: 94,
    color: TEXT_BODY,
  },
  caption: {
    font: "F1",
    fontSize: 9,
    lineHeight: 12,
    marginTop: 0,
    maxChars: 102,
    color: TEXT_MUTED,
  },
};

/* ── PDF graphics primitives ── */

function escapePdfText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r/g, " ")
    .replace(/\n/g, " ");
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

function estimateTextWidth(text: string, fontSize: number, bold = false) {
  // Helvetica average char width: ~0.52 em regular, ~0.56 em bold
  const avgCharWidth = bold ? 0.56 : 0.52;
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
  marginTop = 16,
) {
  advanceY(ctx, marginTop);
  ensureSpace(ctx, 24);

  // Accent bar (3px tall)
  curPage(ctx).push(rectCmd(ML, ctx.y - 1, CW, 3, accentColor));
  advanceY(ctx, 10);

  // Label
  curPage(ctx).push(
    textCmd(label.toUpperCase(), "F2", 9, ML, ctx.y, accentColor),
  );

  // Right-aligned meta
  if (meta) {
    const metaW = estimateTextWidth(meta, 8);
    curPage(ctx).push(
      textCmd(meta, "F1", 8, ML + CW - metaW, ctx.y, TEXT_MUTED),
    );
  }

  advanceY(ctx, 14);
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

      // Card background
      curPage(ctx).push(rectCmd(cx, baseY - cellH, cellW, cellH, BG_STRIPE));

      // Optional accent left border
      if (cell.accentColor) {
        curPage(ctx).push(
          rectCmd(cx, baseY - cellH, 3, cellH, cell.accentColor),
        );
      }

      const textX = cx + (cell.accentColor ? 10 : 8);

      // Label
      curPage(ctx).push(
        textCmd(
          truncate(cell.label.toUpperCase(), 24),
          "F2",
          7,
          textX,
          baseY - 13,
          TEXT_MUTED,
        ),
      );

      // Value
      curPage(ctx).push(
        textCmd(
          truncate(cell.value, 18),
          "F2",
          13,
          textX,
          baseY - 28,
          cell.valueColor ?? TEXT_DARK,
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
      tx = pos.x + pos.w - estimateTextWidth(col.label, 8, true) - 6;
    } else if (pos.align === "center") {
      tx = pos.x + (pos.w - estimateTextWidth(col.label, 8, true)) / 2;
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
        tx = pos.x + pos.w - estimateTextWidth(cellText, fontSize, row.bold) - 6;
      } else if (pos.align === "center") {
        tx = pos.x + (pos.w - estimateTextWidth(cellText, fontSize, row.bold)) / 2;
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
  const barH = 6;
  const totalH = 32 + (block.rangeLabels ? 12 : 0);
  advanceY(ctx, block.marginTop ?? 6);
  ensureSpace(ctx, totalH);

  const baseY = ctx.y;

  // Label + value on same line
  curPage(ctx).push(
    textCmd(block.label, "F2", 9, ML, baseY, TEXT_DARK),
  );
  const valW = estimateTextWidth(block.value, 9, true);
  curPage(ctx).push(
    textCmd(block.value, "F2", 9, ML + CW - valW, baseY, block.fillColor ?? BRAND_GREEN),
  );
  advanceY(ctx, 14);

  // Track
  const trackColor = block.trackColor ?? [0.93, 0.94, 0.93] as RGB;
  const fillColor = block.fillColor ?? BRAND_GREEN;
  const trackY = ctx.y;
  curPage(ctx).push(rectCmd(ML, trackY - barH, CW, barH, trackColor));

  // Fill
  const fillW = Math.max(0, Math.min(1, block.percent / 100)) * CW;
  if (fillW > 0) {
    curPage(ctx).push(rectCmd(ML, trackY - barH, fillW, barH, fillColor));
  }
  advanceY(ctx, barH + 4);

  // Range labels
  if (block.rangeLabels) {
    const [lo, hi] = block.rangeLabels;
    curPage(ctx).push(textCmd(lo, "F1", 7, ML, ctx.y, TEXT_LIGHT));
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

  // Card background
  curPage(ctx).push(rectCmd(ML, baseY - cardH, CW, cardH, BG_STRIPE));

  // Accent left border (3px wide)
  curPage(ctx).push(rectCmd(ML, baseY - cardH, 3, cardH, accentColor));

  // Severity badge
  const badgeText = block.severity.toUpperCase();
  const badgeW = estimateTextWidth(badgeText, 7, true) + 10;
  curPage(ctx).push(rectCmd(ML + CW - badgeW - 6, baseY - 14, badgeW, 11, accentColor));
  curPage(ctx).push(
    textCmd(badgeText, "F2", 7, ML + CW - badgeW - 1, baseY - 12, WHITE),
  );

  // Title
  const textX = ML + 10;
  curPage(ctx).push(textCmd(truncate(block.title, 70), "F2", 10, textX, baseY - 12, TEXT_DARK));
  let lineY = baseY - 26;

  // Body
  for (const line of bodyLines) {
    curPage(ctx).push(textCmd(line, "F1", 9, textX, lineY, TEXT_BODY));
    lineY -= 12;
  }

  // Detail (muted)
  for (const line of detailLines) {
    curPage(ctx).push(textCmd(line, "F1", 8.5, textX, lineY, TEXT_MUTED));
    lineY -= 11;
  }

  // Action (bold)
  for (const line of actionLines) {
    curPage(ctx).push(textCmd(line, "F2", 8.5, textX, lineY, BRAND_GREEN));
    lineY -= 11;
  }

  advanceY(ctx, cardH + 4);
}

function renderStatusBadge(
  ctx: LayoutCtx,
  label: string,
  color: RGB,
  textColor: RGB = WHITE,
  marginTop = 6,
) {
  advanceY(ctx, marginTop);
  ensureSpace(ctx, 20);

  const badgeW = estimateTextWidth(label, 10, true) + 20;
  const badgeH = 18;
  curPage(ctx).push(rectCmd(ML, ctx.y - badgeH, badgeW, badgeH, color));
  curPage(ctx).push(textCmd(label, "F2", 10, ML + 10, ctx.y - 13, textColor));

  advanceY(ctx, badgeH + 6);
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

  const sparkH = block.height ?? 32;
  const totalH = sparkH + 18;
  advanceY(ctx, block.marginTop ?? 8);
  ensureSpace(ctx, totalH);

  const baseY = ctx.y;

  // Label
  curPage(ctx).push(textCmd(block.label, "F2", 8, ML, baseY, TEXT_MUTED));
  advanceY(ctx, 14);

  // Chart area
  const chartY = ctx.y;
  const chartColor = block.color ?? BRAND_GREEN;

  // Background
  curPage(ctx).push(rectCmd(ML, chartY - sparkH, CW, sparkH, BG_STRIPE));

  // Normalize data to chart area
  const minVal = Math.min(...block.data);
  const maxVal = Math.max(...block.data);
  const range = maxVal - minVal || 1;
  const padding = 4;

  const points = block.data.map((val, i) => ({
    x: ML + padding + (i / (block.data.length - 1)) * (CW - padding * 2),
    y:
      chartY -
      sparkH +
      padding +
      ((val - minVal) / range) * (sparkH - padding * 2),
  }));

  // Draw the polyline
  curPage(ctx).push(polylineCmd(points, 1.5, chartColor));

  // End dot
  const lastPt = points[points.length - 1];
  curPage(ctx).push(rectCmd(lastPt.x - 2, lastPt.y - 2, 4, 4, chartColor));

  advanceY(ctx, sparkH + 4);
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

  const sparkH = block.height ?? 42;
  const totalH = sparkH + 30;
  advanceY(ctx, block.marginTop ?? 8);
  ensureSpace(ctx, totalH);

  const baseY = ctx.y;
  curPage(ctx).push(textCmd(block.label, "F2", 8, ML, baseY, TEXT_MUTED));

  let legendX = ML;
  const legendY = baseY - 12;
  for (const series of usableSeries) {
    const legendText = `${series.label}`;
    const legendColor = series.color ?? BRAND_GREEN;
    curPage(ctx).push(textCmd(legendText, "F2", 7, legendX, legendY, legendColor));
    legendX += estimateTextWidth(legendText, 7, true) + 12;
  }

  advanceY(ctx, 18);
  const chartY = ctx.y;
  curPage(ctx).push(rectCmd(ML, chartY - sparkH, CW, sparkH, BG_STRIPE));

  const allValues = usableSeries.flatMap((series) => [...series.data]);
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const range = maxVal - minVal || 1;
  const padding = 4;

  for (const series of usableSeries) {
    const color = series.color ?? BRAND_GREEN;
    const points = series.data.map((value, index) => ({
      x: ML + padding + (index / (series.data.length - 1)) * (CW - padding * 2),
      y:
        chartY -
        sparkH +
        padding +
        ((value - minVal) / range) * (sparkH - padding * 2),
    }));

    curPage(ctx).push(polylineCmd(points, 1.25, color));

    const lastPt = points[points.length - 1];
    curPage(ctx).push(rectCmd(lastPt.x - 2, lastPt.y - 2, 4, 4, color));
  }

  advanceY(ctx, sparkH + 4);
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
    // Top accent bar
    rectCmd(0, PAGE_HEIGHT - 12, PAGE_WIDTH, 12, BRAND_GREEN),
    // Header line
    lineCmd(ML, 760, ML + CW, 760, 0.5, BRAND_GREEN_LIGHT),
    // Footer line
    lineCmd(ML, 44, ML + CW, 44, 0.5, BORDER_LIGHT),
    // Page number (bottom right)
    textCmd(
      `Page ${pageNumber} of ${pageCount}`,
      "F1",
      8,
      ML + CW - 60,
      34,
      TEXT_MUTED,
    ),
    // Confidential footer (bottom left)
    textCmd("Confidential — generated by NocPulse", "F1", 7, ML, 34, TEXT_LIGHT),
  ];

  if (hasLogo) {
    cmds.push(imageCmd(ML, 764, 76, 12, "ImBrand"));
  } else {
    cmds.push(textCmd(author ?? "NocPulse", "F2", 9, ML, 768, BRAND_GREEN));
  }

  // Page 2+ title echo
  if (pageNumber > 1) {
    cmds.push(textCmd(title, "F2", 10, ML, 750, BRAND_GREEN));
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
  const fontRegularObject = nextObject++;
  const fontBoldObject = nextObject++;
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
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "endobj",
  ].join("\n");
  objects[fontBoldObject] = [
    `${fontBoldObject} 0 obj`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
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
      `/Resources << /Font << /F1 ${fontRegularObject} 0 R /F2 ${fontBoldObject} 0 R >>${xObjectSection} >>`,
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
