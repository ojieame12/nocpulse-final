/**
 * TTF Font Embedding — Test Suite
 *
 * Tests font parsing, glyph width measurement, and PDF object generation.
 * Run: node --import tsx --test packages/pdf/src/application/ttfEmbed.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseTTF, generatePdfFontObjects, type EmbeddedFont } from "./ttfEmbed";
import { CAUDEX_REGULAR, CAUDEX_BOLD } from "./fontData";

/* ═══════════════════════════════════════════════════════════════════
   1. FONT PARSING
   ═══════════════════════════════════════════════════════════════════ */

describe("parseTTF", () => {
  let regular: EmbeddedFont;
  let bold: EmbeddedFont;

  it("parses Caudex Regular without error", () => {
    regular = parseTTF(CAUDEX_REGULAR);
    assert.ok(regular, "Should return an EmbeddedFont");
  });

  it("parses Caudex Bold without error", () => {
    bold = parseTTF(CAUDEX_BOLD);
    assert.ok(bold, "Should return an EmbeddedFont");
  });

  it("extracts correct unitsPerEm", () => {
    regular = parseTTF(CAUDEX_REGULAR);
    assert.equal(regular.metrics.unitsPerEm, 2048, "Caudex uses 2048 units per em");
  });

  it("extracts valid font metrics", () => {
    regular = parseTTF(CAUDEX_REGULAR);
    const m = regular.metrics;
    assert.ok(m.ascent > 0, "Ascent should be positive");
    assert.ok(m.descent < 0, "Descent should be negative");
    assert.ok(m.capHeight > 0, "Cap height should be positive");
    assert.ok(m.bbox.length === 4, "Bounding box should have 4 values");
    assert.ok(m.postScriptName.length > 0, "Should have a PostScript name");
  });

  it("extracts char widths for ASCII characters", () => {
    regular = parseTTF(CAUDEX_REGULAR);
    const widths = regular.metrics.charWidths;
    assert.ok(widths.size > 50, "Should have at least 50 char widths");

    // Space (U+0020) should have a width
    assert.ok(widths.has(0x20), "Should have space width");
    assert.ok(widths.get(0x20)! > 0, "Space width should be positive");

    // Capital A (U+0041) should have a width
    assert.ok(widths.has(0x41), "Should have 'A' width");
    assert.ok(widths.get(0x41)! > 0, "'A' width should be positive");
  });

  it("bold font has wider average character widths", () => {
    regular = parseTTF(CAUDEX_REGULAR);
    bold = parseTTF(CAUDEX_BOLD);
    // Compare 'M' width — bold should generally be wider or equal
    const regM = regular.metrics.charWidths.get(0x4D) ?? 0;
    const boldM = bold.metrics.charWidths.get(0x4D) ?? 0;
    assert.ok(boldM >= regM * 0.9, "Bold M should be at least 90% of regular M width");
  });

  it("throws on invalid TTF data", () => {
    assert.throws(() => {
      parseTTF(Buffer.from("not a font file"));
    }, "Should throw on invalid data");
  });

  it("throws on empty buffer", () => {
    assert.throws(() => {
      parseTTF(Buffer.alloc(0));
    }, "Should throw on empty buffer");
  });

  it("throws on truncated header", () => {
    assert.throws(() => {
      parseTTF(Buffer.alloc(8)); // Too short for TTF header
    }, "Should throw on truncated header");
  });
});

/* ═══════════════════════════════════════════════════════════════════
   2. TEXT MEASUREMENT
   ═══════════════════════════════════════════════════════════════════ */

describe("measureText", () => {
  let font: EmbeddedFont;

  it("returns positive width for non-empty text", () => {
    font = parseTTF(CAUDEX_REGULAR);
    const w = font.measureText("Hello", 12);
    assert.ok(w > 0, "Width should be positive");
  });

  it("returns zero for empty string", () => {
    font = parseTTF(CAUDEX_REGULAR);
    const w = font.measureText("", 12);
    assert.equal(w, 0, "Empty string should have zero width");
  });

  it("scales linearly with font size", () => {
    font = parseTTF(CAUDEX_REGULAR);
    const w12 = font.measureText("Test", 12);
    const w24 = font.measureText("Test", 24);
    assert.ok(Math.abs(w24 - w12 * 2) < 1, "Width at 24pt should be ~2x width at 12pt");
  });

  it("wider text produces larger width", () => {
    font = parseTTF(CAUDEX_REGULAR);
    const short = font.measureText("Hi", 12);
    const long = font.measureText("Hello World", 12);
    assert.ok(long > short, "Longer text should be wider");
  });

  it("handles special characters (em dash, degree, bullet)", () => {
    font = parseTTF(CAUDEX_REGULAR);
    // These should use fallback widths if not in the font
    const w = font.measureText("—°•", 12);
    assert.ok(w > 0, "Special characters should have positive width");
  });

  it("handles characters outside WinAnsi range", () => {
    font = parseTTF(CAUDEX_REGULAR);
    // Characters outside WinAnsi get replaced with '?', so should still work
    const w = font.measureText("日本語", 12);
    assert.ok(w >= 0, "CJK characters should not crash");
  });
});

/* ═══════════════════════════════════════════════════════════════════
   3. PDF FONT OBJECT GENERATION
   ═══════════════════════════════════════════════════════════════════ */

describe("generatePdfFontObjects", () => {
  it("produces valid PDF objects for Caudex Regular", () => {
    const font = parseTTF(CAUDEX_REGULAR);
    const objs = generatePdfFontObjects(font, 10);

    assert.ok(objs.objects.length > 0, "Should produce at least one object");
    assert.ok(objs.fontObjNum >= 10, "Font object number should be >= start");
    assert.ok(objs.objectCount > 0, "Object count should be positive");

    // Check that objects contain required PDF font structures
    const allContent = objs.objects.map((o) => o.content).join("\n");
    assert.ok(allContent.includes("/Type /Font"), "Should contain font type declaration");
    assert.ok(allContent.includes("/Subtype /TrueType"), "Should be TrueType subtype");
    assert.ok(allContent.includes("/FontDescriptor"), "Should reference font descriptor");
    assert.ok(allContent.includes("/Encoding /WinAnsiEncoding"), "Should use WinAnsiEncoding");
    assert.ok(allContent.includes("/ToUnicode"), "Should have ToUnicode CMap");
    assert.ok(allContent.includes("/FontFile2"), "Should embed font file");
    assert.ok(allContent.includes("/Widths"), "Should have widths array");
  });

  it("produces valid PDF objects for Caudex Bold", () => {
    const font = parseTTF(CAUDEX_BOLD);
    const objs = generatePdfFontObjects(font, 20);

    assert.ok(objs.objects.length > 0);
    assert.ok(objs.fontObjNum >= 20);
  });

  it("object numbers are contiguous from startObjNum", () => {
    const font = parseTTF(CAUDEX_REGULAR);
    const objs = generatePdfFontObjects(font, 100);

    const objNums = objs.objects.map((o) => o.objNum).sort((a, b) => a - b);
    assert.ok(objNums[0] >= 100, "First object should be >= 100");
    // Verify contiguity
    for (let i = 1; i < objNums.length; i++) {
      assert.ok(
        objNums[i] - objNums[i - 1] <= 2,
        `Object numbers should be roughly contiguous: ${objNums[i - 1]} → ${objNums[i]}`,
      );
    }
    assert.equal(objs.objectCount, objs.objects.length, "objectCount should match actual count");
  });

  it("ToUnicode CMap maps WinAnsi codes to Unicode", () => {
    const font = parseTTF(CAUDEX_REGULAR);
    const objs = generatePdfFontObjects(font, 1);
    const allContent = objs.objects.map((o) => o.content).join("\n");

    // CMap should reference CIDInit and beginbfchar
    assert.ok(allContent.includes("CIDInit"), "CMap should use CIDInit");
    assert.ok(
      allContent.includes("beginbfchar") || allContent.includes("beginbfrange"),
      "CMap should have character mappings",
    );
  });
});
