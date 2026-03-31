/**
 * Minimal TrueType font parser + PDF embedding for the NocPulse PDF renderer.
 *
 * Reads a .ttf binary and extracts enough information to:
 *   1. Embed the full font program as a TrueType font in a PDF 1.4 file
 *   2. Build a /Widths array for accurate glyph width measurement
 *   3. Produce a /ToUnicode CMap for copy-paste text extraction
 *   4. Provide runtime character-width lookups for text layout
 *
 * Uses WinAnsiEncoding (same as the built-in fonts) so the existing
 * escapePdfText pipeline works unchanged.
 *
 * Zero external dependencies — operates on raw Buffer/Uint8Array.
 */

/* ── Public types ── */

export interface EmbeddedFontMetrics {
  unitsPerEm: number;
  ascent: number;
  descent: number;
  capHeight: number;
  italicAngle: number;
  bbox: [number, number, number, number];
  postScriptName: string;
  /** Map from Unicode code point → advance width in font units */
  charWidths: Map<number, number>;
}

export interface EmbeddedFont {
  metrics: EmbeddedFontMetrics;
  ttfBytes: Uint8Array;
  /**
   * Compute the advance width of `text` in PDF points at `fontSize`.
   * Characters are mapped through WinAnsi, same as PDF text output.
   */
  measureText(text: string, fontSize: number): number;
}

/* ── WinAnsi ↔ Unicode mapping ── */

const WINANSI_SPECIAL: Record<number, number> = {
  0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e,
  0x85: 0x2026, 0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02c6,
  0x89: 0x2030, 0x8a: 0x0160, 0x8b: 0x2039, 0x8c: 0x0152,
  0x8e: 0x017d, 0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201c,
  0x94: 0x201d, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014,
  0x98: 0x02dc, 0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a,
  0x9c: 0x0153, 0x9e: 0x017e, 0x9f: 0x0178,
};

function winAnsiToUnicode(code: number): number {
  return WINANSI_SPECIAL[code] ?? code;
}

/* ── Binary reader helpers ── */

class BinaryReader {
  private view: DataView;
  constructor(private buf: Uint8Array) {
    this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  u16(offset: number) { return this.view.getUint16(offset, false); }
  i16(offset: number) { return this.view.getInt16(offset, false); }
  u32(offset: number) { return this.view.getUint32(offset, false); }
  i32(offset: number) { return this.view.getInt32(offset, false); }
  fixed(offset: number) { return this.i32(offset) / 65536; }
  ascii(offset: number, length: number) {
    let s = "";
    for (let i = 0; i < length; i++) s += String.fromCharCode(this.buf[offset + i]);
    return s;
  }
}

/* ── Table directory ── */

interface TableEntry { tag: string; offset: number; length: number }

function readTableDirectory(r: BinaryReader): Map<string, TableEntry> {
  const numTables = r.u16(4);
  const tables = new Map<string, TableEntry>();
  for (let i = 0; i < numTables; i++) {
    const base = 12 + i * 16;
    const tag = r.ascii(base, 4);
    tables.set(tag, { tag, offset: r.u32(base + 8), length: r.u32(base + 12) });
  }
  return tables;
}

/* ── Individual table parsers ── */

function parseHead(r: BinaryReader, t: TableEntry) {
  const o = t.offset;
  return {
    unitsPerEm: r.u16(o + 18),
    xMin: r.i16(o + 36), yMin: r.i16(o + 38),
    xMax: r.i16(o + 40), yMax: r.i16(o + 42),
  };
}

function parseHhea(r: BinaryReader, t: TableEntry) {
  const o = t.offset;
  return {
    ascent: r.i16(o + 4),
    descent: r.i16(o + 6),
    numOfLongHorMetrics: r.u16(o + 34),
  };
}

function parseOs2(r: BinaryReader, t: TableEntry) {
  const o = t.offset;
  return {
    sCapHeight: t.length >= 90 ? r.i16(o + 88) : Math.round(r.u16(o + 18) * 0.7),
  };
}

function parsePost(r: BinaryReader, t: TableEntry) {
  return { italicAngle: r.fixed(t.offset + 4) };
}

function parseName(r: BinaryReader, t: TableEntry): string {
  const o = t.offset;
  const count = r.u16(o + 2);
  const stringOffset = o + r.u16(o + 4);
  for (let i = 0; i < count; i++) {
    const rec = o + 6 + i * 12;
    const platformID = r.u16(rec);
    const nameID = r.u16(rec + 6);
    const len = r.u16(rec + 8);
    const off = r.u16(rec + 10);
    if (nameID === 6) {
      if (platformID === 1) return r.ascii(stringOffset + off, len);
      if (platformID === 3) {
        let s = "";
        for (let j = 0; j < len; j += 2) s += String.fromCharCode(r.u16(stringOffset + off + j));
        return s;
      }
    }
  }
  return "UnknownFont";
}

function parseMaxp(r: BinaryReader, t: TableEntry) {
  return { numGlyphs: r.u16(t.offset + 4) };
}

/** Parse cmap table — extract format 4 (BMP) Unicode → GlyphID mapping */
function parseCmap(r: BinaryReader, t: TableEntry): Map<number, number> {
  const o = t.offset;
  const numSubtables = r.u16(o + 2);
  let fmt4Offset = -1;

  for (let i = 0; i < numSubtables; i++) {
    const sub = o + 4 + i * 8;
    const platformID = r.u16(sub);
    const encodingID = r.u16(sub + 2);
    const subtableOffset = r.u32(sub + 4);
    const format = r.u16(o + subtableOffset);
    if (format === 4 && (platformID === 0 || (platformID === 3 && encodingID === 1))) {
      fmt4Offset = o + subtableOffset;
      break;
    }
  }

  const mapping = new Map<number, number>();
  if (fmt4Offset < 0) return mapping;

  const segCount = r.u16(fmt4Offset + 6) / 2;
  const endCodeBase = fmt4Offset + 14;
  const startCodeBase = endCodeBase + segCount * 2 + 2;
  const idDeltaBase = startCodeBase + segCount * 2;
  const idRangeBase = idDeltaBase + segCount * 2;

  for (let seg = 0; seg < segCount; seg++) {
    const endCode = r.u16(endCodeBase + seg * 2);
    const startCode = r.u16(startCodeBase + seg * 2);
    const idDelta = r.i16(idDeltaBase + seg * 2);
    const idRangeOffset = r.u16(idRangeBase + seg * 2);
    if (startCode === 0xffff) break;

    for (let code = startCode; code <= endCode; code++) {
      let glyphId: number;
      if (idRangeOffset === 0) {
        glyphId = (code + idDelta) & 0xffff;
      } else {
        const addr = idRangeBase + seg * 2 + idRangeOffset + (code - startCode) * 2;
        glyphId = r.u16(addr);
        if (glyphId !== 0) glyphId = (glyphId + idDelta) & 0xffff;
      }
      if (glyphId !== 0) mapping.set(code, glyphId);
    }
  }
  return mapping;
}

/** Parse hmtx table — returns advance widths indexed by glyphID */
function parseHmtx(
  r: BinaryReader, t: TableEntry,
  numLong: number, numGlyphs: number,
): number[] {
  const o = t.offset;
  const widths = new Array<number>(numGlyphs);
  let last = 0;
  for (let i = 0; i < numLong; i++) {
    last = r.u16(o + i * 4);
    widths[i] = last;
  }
  for (let i = numLong; i < numGlyphs; i++) widths[i] = last;
  return widths;
}

/* ── Main parser ── */

export function parseTTF(ttfBytes: Uint8Array): EmbeddedFont {
  const r = new BinaryReader(ttfBytes);
  const tables = readTableDirectory(r);

  for (const tag of ["head", "hhea", "hmtx", "cmap", "maxp", "name"]) {
    if (!tables.has(tag)) throw new Error(`Missing required TTF table: ${tag}`);
  }

  const head = parseHead(r, tables.get("head")!);
  const hhea = parseHhea(r, tables.get("hhea")!);
  const maxp = parseMaxp(r, tables.get("maxp")!);
  const os2 = tables.has("OS/2") ? parseOs2(r, tables.get("OS/2")!) : null;
  const post = tables.has("post") ? parsePost(r, tables.get("post")!) : { italicAngle: 0 };
  const postScriptName = parseName(r, tables.get("name")!);

  const unicodeToGlyph = parseCmap(r, tables.get("cmap")!);
  const glyphWidths = parseHmtx(r, tables.get("hmtx")!, hhea.numOfLongHorMetrics, maxp.numGlyphs);

  // Build Unicode → advance width map
  const charWidths = new Map<number, number>();
  for (const [unicode, glyphId] of unicodeToGlyph) {
    if (glyphId < glyphWidths.length) {
      charWidths.set(unicode, glyphWidths[glyphId]);
    }
  }

  // Average width for fallback
  let total = 0, count = 0;
  for (const w of charWidths.values()) { total += w; count++; }
  const avgWidth = count > 0 ? total / count : 500;

  const upm = head.unitsPerEm;
  const metrics: EmbeddedFontMetrics = {
    unitsPerEm: upm,
    ascent: hhea.ascent,
    descent: hhea.descent,
    capHeight: os2?.sCapHeight ?? Math.round(upm * 0.7),
    italicAngle: post.italicAngle,
    bbox: [head.xMin, head.yMin, head.xMax, head.yMax],
    postScriptName,
    charWidths,
  };

  return {
    metrics,
    ttfBytes,
    measureText(text: string, fontSize: number): number {
      let t = 0;
      for (const ch of text) {
        const code = ch.codePointAt(0)!;
        t += charWidths.get(code) ?? avgWidth;
      }
      return (t / upm) * fontSize;
    },
  };
}

/* ── PDF object generation ── */

export interface PdfFontObjects {
  /** The PDF objects to append */
  objects: { objNum: number; content: string }[];
  /** Object number of the font dict (for /Resources) */
  fontObjNum: number;
  /** Total objects consumed */
  objectCount: number;
}

/**
 * Generate PDF objects to embed a TrueType font with WinAnsiEncoding.
 *
 * This produces a simple /TrueType font (not CIDFont) so it works
 * identically to the built-in Type1 fonts in terms of text encoding.
 */
export function generatePdfFontObjects(
  font: EmbeddedFont,
  startObjNum: number,
): PdfFontObjects {
  const m = font.metrics;
  const scale = 1000 / m.unitsPerEm; // normalize to PDF's 1000-unit convention

  const fontFileObj = startObjNum;
  const fontDescObj = startObjNum + 1;
  const fontDictObj = startObjNum + 2;
  const toUnicodeObj = startObjNum + 3;

  const objects: { objNum: number; content: string }[] = [];

  // 1. Font file stream (raw TTF embedded as hex)
  const ttfHex = bufferToHex(font.ttfBytes);
  objects.push({
    objNum: fontFileObj,
    content: [
      `${fontFileObj} 0 obj`,
      `<< /Length ${ttfHex.length} /Length1 ${font.ttfBytes.length} /Filter /ASCIIHexDecode >>`,
      "stream",
      ttfHex,
      "endstream",
      "endobj",
    ].join("\n"),
  });

  // 2. FontDescriptor
  const flags = 0x00000042; // Serif | Nonsymbolic
  const [xMin, yMin, xMax, yMax] = m.bbox;
  objects.push({
    objNum: fontDescObj,
    content: [
      `${fontDescObj} 0 obj`,
      `<< /Type /FontDescriptor`,
      `/FontName /${m.postScriptName}`,
      `/Flags ${flags}`,
      `/FontBBox [${Math.round(xMin * scale)} ${Math.round(yMin * scale)} ${Math.round(xMax * scale)} ${Math.round(yMax * scale)}]`,
      `/ItalicAngle ${m.italicAngle}`,
      `/Ascent ${Math.round(m.ascent * scale)}`,
      `/Descent ${Math.round(m.descent * scale)}`,
      `/CapHeight ${Math.round(m.capHeight * scale)}`,
      `/StemV 80`,
      `/FontFile2 ${fontFileObj} 0 R`,
      `>>`,
      "endobj",
    ].join("\n"),
  });

  // 3. ToUnicode CMap
  const toUnicodeStream = buildToUnicodeCMap(m.charWidths);
  objects.push({
    objNum: toUnicodeObj,
    content: [
      `${toUnicodeObj} 0 obj`,
      `<< /Length ${toUnicodeStream.length} >>`,
      "stream",
      toUnicodeStream,
      "endstream",
      "endobj",
    ].join("\n"),
  });

  // 4. Font dictionary — TrueType with WinAnsiEncoding
  // /Widths array: widths for characters 32..255 (FirstChar=32, LastChar=255)
  const widths: number[] = [];
  for (let code = 32; code <= 255; code++) {
    const unicode = winAnsiToUnicode(code);
    const rawWidth = m.charWidths.get(unicode) ?? 0;
    widths.push(Math.round(rawWidth * scale));
  }

  objects.push({
    objNum: fontDictObj,
    content: [
      `${fontDictObj} 0 obj`,
      `<< /Type /Font`,
      `/Subtype /TrueType`,
      `/BaseFont /${m.postScriptName}`,
      `/Encoding /WinAnsiEncoding`,
      `/FirstChar 32`,
      `/LastChar 255`,
      `/Widths [${widths.join(" ")}]`,
      `/FontDescriptor ${fontDescObj} 0 R`,
      `/ToUnicode ${toUnicodeObj} 0 R`,
      `>>`,
      "endobj",
    ].join("\n"),
  });

  return {
    objects,
    fontObjNum: fontDictObj,
    objectCount: 4,
  };
}

/* ── Helpers ── */

function bufferToHex(buf: Uint8Array): string {
  const chunks: string[] = [];
  for (let i = 0; i < buf.length; i += 4096) {
    const end = Math.min(i + 4096, buf.length);
    let hex = "";
    for (let j = i; j < end; j++) hex += buf[j].toString(16).padStart(2, "0");
    chunks.push(hex);
  }
  return chunks.join("\n") + ">";
}

function buildToUnicodeCMap(charWidths: Map<number, number>): string {
  const entries: string[] = [];
  for (let code = 32; code < 256; code++) {
    const unicode = winAnsiToUnicode(code);
    if (charWidths.has(unicode)) {
      entries.push(
        `<${code.toString(16).padStart(2, "0")}> <${unicode.toString(16).padStart(4, "0")}>`,
      );
    }
  }

  const chunks: string[][] = [];
  for (let i = 0; i < entries.length; i += 100) chunks.push(entries.slice(i, i + 100));

  const sections = chunks.map(
    (chunk) => `${chunk.length} beginbfchar\n${chunk.join("\n")}\nendbfchar`,
  );

  return [
    "/CIDInit /ProcSet findresource begin",
    "12 dict begin",
    "begincmap",
    "/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def",
    "/CMapName /Adobe-Identity-UCS def",
    "/CMapType 2 def",
    "1 begincodespacerange",
    "<00> <FF>",
    "endcodespacerange",
    ...sections,
    "endcmap",
    "CMapName currentdict /CMap defineresource pop",
    "end",
    "end",
  ].join("\n");
}
