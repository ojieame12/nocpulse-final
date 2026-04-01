/**
 * NocPulse PDF Renderer — Test Suite
 *
 * Uses Node's built-in test runner (node --test).
 * Run: node --import tsx --test packages/pdf/src/application/renderPdfDocument.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderPdfDocument, type PdfBlock, type PdfRenderInput, type RGB } from "../index";

/* ── Helpers ── */

const GREEN: RGB = [0.08, 0.24, 0.17];
const RED: RGB = [0.93, 0.27, 0.27];

function render(blocks: PdfBlock[], title = "Test"): ReturnType<typeof renderPdfDocument> {
  return renderPdfDocument({
    artifactKey: "test/test.pdf",
    title,
    subject: "Test PDF",
    author: "NocPulse Test",
    blocks,
  });
}

function pdfText(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("latin1");
}

/* ═══════════════════════════════════════════════════════════════════
   1. BASIC RENDERING — every block type produces valid PDF
   ═══════════════════════════════════════════════════════════════════ */

describe("renderPdfDocument", () => {
  describe("produces valid PDF output", () => {
    it("renders empty blocks array", () => {
      const result = render([]);
      assert.ok(result.bytes.length > 0, "PDF should have non-zero bytes");
      assert.ok(result.metadata.pageCount >= 1, "Should have at least 1 page");
      const text = pdfText(result.bytes);
      assert.ok(text.startsWith("%PDF-1.4"), "Should start with PDF header");
      assert.ok(text.includes("%%EOF"), "Should end with EOF marker");
    });

    it("contains valid xref table", () => {
      const result = render([{ kind: "text", style: "body", text: "Hello" }]);
      const text = pdfText(result.bytes);
      assert.ok(text.includes("xref"), "Should contain xref table");
      assert.ok(text.includes("trailer"), "Should contain trailer");
      assert.ok(text.includes("/Type /Catalog"), "Should contain catalog object");
    });

    it("metadata is accurate", () => {
      const result = render([{ kind: "text", style: "body", text: "Test" }]);
      assert.equal(result.metadata.byteSize, result.bytes.length);
      assert.ok(result.metadata.sha256.length === 64, "SHA256 should be 64 hex chars");
      assert.equal(result.metadata.pageCount, 1);
    });
  });

  /* ── 2. INDIVIDUAL BLOCK TYPES ── */

  describe("text blocks", () => {
    for (const style of ["title", "heading", "subheading", "body", "caption"] as const) {
      it(`renders ${style} style`, () => {
        const result = render([{ kind: "text", style, text: `Test ${style}` }]);
        assert.ok(result.bytes.length > 0);
        assert.equal(result.metadata.pageCount, 1);
      });
    }

    it("handles empty text", () => {
      const result = render([{ kind: "text", style: "body", text: "" }]);
      assert.ok(result.bytes.length > 0);
    });

    it("handles very long text", () => {
      const longText = "A".repeat(2000);
      const result = render([{ kind: "text", style: "body", text: longText }]);
      assert.ok(result.bytes.length > 0);
    });
  });

  describe("spacer blocks", () => {
    it("renders zero-height spacer", () => {
      const result = render([{ kind: "spacer", height: 0 }]);
      assert.ok(result.bytes.length > 0);
    });

    it("renders large spacer without crash", () => {
      const result = render([{ kind: "spacer", height: 500 }]);
      assert.ok(result.bytes.length > 0);
    });
  });

  describe("divider blocks", () => {
    it("renders with defaults", () => {
      const result = render([{ kind: "divider" }]);
      assert.ok(result.bytes.length > 0);
    });

    it("renders with custom color and thickness", () => {
      const result = render([
        { kind: "divider", color: RED, thickness: 2, marginTop: 10 },
      ]);
      assert.ok(result.bytes.length > 0);
    });
  });

  describe("metric-strip blocks", () => {
    it("renders with multiple cells", () => {
      const result = render([{
        kind: "metric-strip",
        cells: [
          { label: "A", value: "100" },
          { label: "B", value: "200", valueColor: RED },
          { label: "C", value: "300" },
        ],
      }]);
      assert.ok(result.bytes.length > 0);
    });

    it("renders with empty cells array", () => {
      const result = render([{ kind: "metric-strip", cells: [] }]);
      assert.ok(result.bytes.length > 0);
    });

    it("renders single cell", () => {
      const result = render([{
        kind: "metric-strip",
        cells: [{ label: "Only", value: "1" }],
      }]);
      assert.ok(result.bytes.length > 0);
    });
  });

  describe("metric-grid blocks", () => {
    for (const columns of [2, 3, 4] as const) {
      it(`renders ${columns}-column grid`, () => {
        const cells = Array.from({ length: columns + 2 }, (_, i) => ({
          label: `Metric ${i}`,
          value: `${i * 10}`,
          sub: `Sub ${i}`,
        }));
        const result = render([{ kind: "metric-grid", cells, columns }]);
        assert.ok(result.bytes.length > 0);
      });
    }

    it("renders with empty cells", () => {
      const result = render([{ kind: "metric-grid", cells: [], columns: 4 }]);
      assert.ok(result.bytes.length > 0);
    });

    it("renders with accent colors", () => {
      const result = render([{
        kind: "metric-grid",
        cells: [
          { label: "Good", value: "OK", accentColor: GREEN },
          { label: "Bad", value: "FAIL", valueColor: RED, accentColor: RED },
        ],
        columns: 2,
      }]);
      assert.ok(result.bytes.length > 0);
    });
  });

  describe("table blocks", () => {
    it("renders basic table", () => {
      const result = render([{
        kind: "table",
        columns: [
          { label: "Name", width: 0.5 },
          { label: "Value", width: 0.5, align: "right" },
        ],
        rows: [
          { cells: ["Temperature", "-6.4°C"] },
          { cells: ["Moisture", "20.2%"] },
        ],
        headerBg: GREEN,
      }]);
      assert.ok(result.bytes.length > 0);
    });

    it("renders table with zero rows", () => {
      const result = render([{
        kind: "table",
        columns: [{ label: "Col", width: 1.0 }],
        rows: [],
        headerBg: GREEN,
      }]);
      assert.ok(result.bytes.length > 0);
    });

    it("renders table with accent colors and bold rows", () => {
      const result = render([{
        kind: "table",
        columns: [
          { label: "Signal", width: 0.3 },
          { label: "Value", width: 0.2 },
          { label: "Notes", width: 0.5 },
        ],
        rows: [
          { cells: ["Frost", "-11°C", "Hard frost risk"], accentColor: RED, bold: true },
          { cells: ["VPD", "0.06", "Within range"] },
        ],
        headerBg: GREEN,
      }]);
      assert.ok(result.bytes.length > 0);
    });

    it("handles very long cell text gracefully", () => {
      const longNote = "A".repeat(200);
      const result = render([{
        kind: "table",
        columns: [
          { label: "Param", width: 0.3 },
          { label: "Notes", width: 0.7 },
        ],
        rows: [{ cells: ["Test", longNote] }],
      }]);
      assert.ok(result.bytes.length > 0);
    });

    it("renders 5-column assessment table", () => {
      const result = render([{
        kind: "table",
        columns: [
          { label: "Parameter", width: 0.18 },
          { label: "Current", width: 0.12, align: "right" },
          { label: "Expected Range", width: 0.18 },
          { label: "Status", width: 0.10 },
          { label: "Notes", width: 0.42 },
        ],
        headerBg: GREEN,
        rows: [
          { cells: ["Root Moisture", "20.2%", "22% – 70%", "Below", "Below optimal. Monitor for wilting and schedule irrigation."], accentColor: RED },
          { cells: ["Surface Moisture", "12.3%", "21% – 60%", "Below", "Surface is dry. Seed germination risk if planting."], accentColor: RED },
          { cells: ["Water Balance", "+3.2 mm", "-6mm – >0mm", "In range", "Within acceptable range for selected crop."] },
        ],
      }]);
      assert.ok(result.bytes.length > 0);
    });
  });

  describe("progress-bar blocks", () => {
    it("renders with range labels", () => {
      const result = render([{
        kind: "progress-bar",
        label: "Root Moisture",
        value: "20.2%",
        percent: 20.2,
        fillColor: RED,
        rangeLabels: ["0%", "100%"],
      }]);
      assert.ok(result.bytes.length > 0);
    });

    it("handles 0% fill", () => {
      const result = render([{
        kind: "progress-bar",
        label: "Empty",
        value: "0%",
        percent: 0,
      }]);
      assert.ok(result.bytes.length > 0);
    });

    it("handles 100% fill", () => {
      const result = render([{
        kind: "progress-bar",
        label: "Full",
        value: "100%",
        percent: 100,
      }]);
      assert.ok(result.bytes.length > 0);
    });

    it("clamps percent > 100", () => {
      const result = render([{
        kind: "progress-bar",
        label: "Over",
        value: "150%",
        percent: 150,
      }]);
      assert.ok(result.bytes.length > 0);
    });
  });

  describe("severity-card blocks", () => {
    for (const severity of ["critical", "warning", "info"] as const) {
      it(`renders ${severity} severity`, () => {
        const result = render([{
          kind: "severity-card",
          severity,
          title: `${severity} alert`,
          body: "Details here",
          action: "Do something",
        }]);
        assert.ok(result.bytes.length > 0);
      });
    }

    it("renders minimal card (title only)", () => {
      const result = render([{
        kind: "severity-card",
        severity: "info",
        title: "Simple alert",
      }]);
      assert.ok(result.bytes.length > 0);
    });

    it("renders card with detail", () => {
      const result = render([{
        kind: "severity-card",
        severity: "critical",
        title: "Alert",
        body: "Body text",
        detail: "2 tracked zones linked",
        action: "Check now",
      }]);
      assert.ok(result.bytes.length > 0);
    });
  });

  describe("status-badge blocks", () => {
    it("renders with custom colors", () => {
      const result = render([{
        kind: "status-badge",
        label: "Needs Attention",
        color: RED,
      }]);
      assert.ok(result.bytes.length > 0);
    });
  });

  describe("key-value blocks", () => {
    it("renders 1-column layout", () => {
      const result = render([{
        kind: "key-value",
        pairs: [
          { key: "Crop", value: "Rye" },
          { key: "Stage", value: "Vegetative" },
        ],
        columns: 1,
      }]);
      assert.ok(result.bytes.length > 0);
    });

    it("renders 2-column layout", () => {
      const result = render([{
        kind: "key-value",
        pairs: [
          { key: "Crop", value: "Rye" },
          { key: "Stage", value: "Vegetative" },
          { key: "Size", value: "259 ha" },
          { key: "LLD", value: "NE-15-034" },
        ],
        columns: 2,
      }]);
      assert.ok(result.bytes.length > 0);
    });

    it("renders empty pairs", () => {
      const result = render([{ kind: "key-value", pairs: [] }]);
      assert.ok(result.bytes.length > 0);
    });
  });

  describe("section-header blocks", () => {
    it("renders with meta text", () => {
      const result = render([{
        kind: "section-header",
        label: "Moisture Conditions",
        meta: "Field average",
        accentColor: GREEN,
      }]);
      assert.ok(result.bytes.length > 0);
    });

    it("renders without meta", () => {
      const result = render([{
        kind: "section-header",
        label: "Alerts",
      }]);
      assert.ok(result.bytes.length > 0);
    });
  });

  /* ── 3. SPARKLINE EDGE CASES (the critical bugs we fixed) ── */

  describe("sparkline blocks", () => {
    it("renders normal sparkline", () => {
      const result = render([{
        kind: "sparkline",
        label: "Precipitation",
        data: [0, 1, 3, 2, 5, 4, 1],
        color: [0.23, 0.51, 0.85] as RGB,
        height: 48,
      }]);
      assert.ok(result.bytes.length > 0);
    });

    it("skips sparkline with 0 data points (no crash)", () => {
      const result = render([{
        kind: "sparkline",
        label: "Empty",
        data: [],
      }]);
      assert.ok(result.bytes.length > 0);
    });

    it("skips sparkline with 1 data point (no crash)", () => {
      const result = render([{
        kind: "sparkline",
        label: "Single",
        data: [42],
      }]);
      assert.ok(result.bytes.length > 0);
    });

    it("renders sparkline with exactly 2 data points", () => {
      const result = render([{
        kind: "sparkline",
        label: "Minimal",
        data: [10, 20],
      }]);
      assert.ok(result.bytes.length > 0);
    });

    it("handles all-zero data", () => {
      const result = render([{
        kind: "sparkline",
        label: "Flat",
        data: [0, 0, 0, 0, 0],
      }]);
      assert.ok(result.bytes.length > 0);
    });

    it("handles all-same-value data", () => {
      const result = render([{
        kind: "sparkline",
        label: "Flat nonzero",
        data: [5.5, 5.5, 5.5],
      }]);
      assert.ok(result.bytes.length > 0);
    });

    it("handles negative values", () => {
      const result = render([{
        kind: "sparkline",
        label: "Cold temps",
        data: [-30, -20, -15, -25, -10],
      }]);
      assert.ok(result.bytes.length > 0);
    });

    it("handles very large values", () => {
      const result = render([{
        kind: "sparkline",
        label: "Big numbers",
        data: [1e6, 2e6, 1.5e6],
      }]);
      assert.ok(result.bytes.length > 0);
    });
  });

  describe("multi-sparkline blocks", () => {
    it("renders dual-series chart", () => {
      const result = render([{
        kind: "multi-sparkline",
        label: "Temperature Window",
        series: [
          { label: "High", data: [-6, 0, 5, 3], color: RED },
          { label: "Low", data: [-10, -8, -3, -5], color: [0.23, 0.51, 0.85] as RGB },
        ],
        height: 56,
      }]);
      assert.ok(result.bytes.length > 0);
    });

    it("skips if all series have < 2 points (no crash)", () => {
      const result = render([{
        kind: "multi-sparkline",
        label: "Empty",
        series: [
          { label: "A", data: [1] },
          { label: "B", data: [] },
        ],
      }]);
      assert.ok(result.bytes.length > 0);
    });

    it("renders with one usable and one unusable series", () => {
      const result = render([{
        kind: "multi-sparkline",
        label: "Mixed",
        series: [
          { label: "Good", data: [1, 2, 3] },
          { label: "Bad", data: [5] }, // filtered out
        ],
      }]);
      assert.ok(result.bytes.length > 0);
    });

    it("handles all-same-value across series", () => {
      const result = render([{
        kind: "multi-sparkline",
        label: "Flat",
        series: [
          { label: "A", data: [10, 10, 10] },
          { label: "B", data: [10, 10, 10] },
        ],
      }]);
      assert.ok(result.bytes.length > 0);
    });

    it("handles exactly 2 points per series", () => {
      const result = render([{
        kind: "multi-sparkline",
        label: "Minimal",
        series: [
          { label: "A", data: [0, 100] },
          { label: "B", data: [50, 50] },
        ],
      }]);
      assert.ok(result.bytes.length > 0);
    });

    it("handles empty series array", () => {
      const result = render([{
        kind: "multi-sparkline",
        label: "No series",
        series: [],
      }]);
      assert.ok(result.bytes.length > 0);
    });
  });

  /* ── 4. PAGE BREAK LOGIC ── */

  describe("page breaks", () => {
    it("creates multiple pages for large content", () => {
      const blocks: PdfBlock[] = [];
      for (let i = 0; i < 50; i++) {
        blocks.push({
          kind: "severity-card",
          severity: "critical",
          title: `Alert ${i}: This is a test alert with some text`,
          body: "Details about this alert go here with enough text to take space",
          action: "Take action immediately",
        });
      }
      const result = render(blocks);
      assert.ok(result.metadata.pageCount > 1, "Should span multiple pages");
    });

    it("handles page break mid-table", () => {
      const rows = Array.from({ length: 60 }, (_, i) => ({
        cells: [`Row ${i}`, `Value ${i}`, `Notes for row ${i}`],
      }));
      const result = render([{
        kind: "table",
        columns: [
          { label: "Item", width: 0.3 },
          { label: "Value", width: 0.2 },
          { label: "Notes", width: 0.5 },
        ],
        rows,
        headerBg: GREEN,
      }]);
      assert.ok(result.metadata.pageCount > 1, "Large table should span pages");
    });
  });

  /* ── 5. SPECIAL CHARACTER ENCODING ── */

  describe("text encoding", () => {
    it("handles em dashes and special characters", () => {
      const result = render([
        { kind: "text", style: "title", text: "Biehn West — Crop Report" },
        { kind: "text", style: "body", text: "Temperature: -6.4°C • Moisture: 20.2%" },
        { kind: "text", style: "body", text: "Range: 17.4–23.1% © NocPulse™" },
        { kind: "text", style: "body", text: "Smart quotes: \u201Chello\u201D and \u2018world\u2019" },
        { kind: "text", style: "body", text: "Ellipsis… and middle dot · separator" },
      ]);
      assert.ok(result.bytes.length > 0);
      // Verify no raw UTF-8 multi-byte sequences leak through
      // (characters > 0x7F should be octal-escaped, not raw bytes)
      const text = pdfText(result.bytes);
      assert.ok(!text.includes("â\u0080"), "Should not contain UTF-8 lead byte for em dash");
      assert.ok(!text.includes("Ã"), "Should not contain UTF-8 lead byte 0xC3");
    });
  });

  /* ── 6. COMBINED REAL-WORLD REPORT ── */

  describe("full field report rendering", () => {
    it("renders a complete multi-section report", () => {
      const blocks: PdfBlock[] = [
        { kind: "text", style: "title", text: "Biehn" },
        { kind: "text", style: "subheading", text: "Field Report — Mar 31, 2026" },
        { kind: "status-badge", label: "Needs Attention", color: RED },
        { kind: "key-value", pairs: [{ key: "Crop", value: "Rye" }, { key: "Size", value: "259 ha" }], columns: 2 },
        { kind: "metric-strip", cells: [{ label: "Alerts", value: "2 Active", valueColor: RED }] },
        { kind: "section-header", label: "Action Required", meta: "2 items", accentColor: RED },
        { kind: "severity-card", severity: "critical", title: "Frost risk", action: "Protect crops" },
        { kind: "section-header", label: "Current Readings", meta: "9 metrics", accentColor: GREEN },
        { kind: "metric-grid", cells: [
          { label: "Temperature", value: "-6.4°C" },
          { label: "Moisture", value: "20.2%" },
          { label: "Wind", value: "21 km/h" },
          { label: "NDVI", value: "Not available" },
        ], columns: 4 },
        { kind: "section-header", label: "Crop Parameter Assessment", accentColor: GREEN },
        { kind: "table", columns: [
          { label: "Parameter", width: 0.18 },
          { label: "Current", width: 0.12, align: "right" },
          { label: "Expected Range", width: 0.18 },
          { label: "Status", width: 0.10 },
          { label: "Notes", width: 0.42 },
        ], headerBg: GREEN, rows: [
          { cells: ["Root Moisture", "20.2%", "22%–70%", "Below", "Below optimal. Monitor for wilting."], accentColor: RED },
          { cells: ["Peak VPD", "0.1 kPa", "0–1.8 kPa", "In range", "Within acceptable range."] },
        ] },
        { kind: "section-header", label: "7-Day Forecast", accentColor: GREEN },
        { kind: "table", columns: [
          { label: "Day", width: 0.25 },
          { label: "Conditions", width: 0.25 },
          { label: "Temp", width: 0.25 },
          { label: "Precip", width: 0.25, align: "right" },
        ], headerBg: GREEN, rows: [
          { cells: ["Mon", "Frost risk", "-6/-6°C", "1%"], accentColor: RED },
          { cells: ["Tue", "Deep frost", "0/-10°C", "1%"], accentColor: RED },
        ] },
        { kind: "sparkline", label: "Precipitation (mm)", data: [1, 1, 0.5, 0], color: [0.23, 0.51, 0.85] as RGB },
        { kind: "multi-sparkline", label: "Temp Window (°C)", series: [
          { label: "High", data: [-6, 0, 2], color: RED },
          { label: "Low", data: [-6, -10, -8], color: [0.23, 0.51, 0.85] as RGB },
        ] },
        { kind: "section-header", label: "Weather Signal Assessment", accentColor: GREEN },
        { kind: "table", columns: [
          { label: "Signal", width: 0.20 },
          { label: "Value", width: 0.13, align: "right" },
          { label: "Threshold", width: 0.13 },
          { label: "Status", width: 0.10 },
          { label: "Notes", width: 0.44 },
        ], headerBg: GREEN, rows: [
          { cells: ["VPD", "0.06 kPa", "0.4–1.5", "Low", "Fungal disease risk elevated."] },
          { cells: ["Frost Min", "-11.4°C", "> 2°C", "Risk", "Hard frost. Crop damage risk."], accentColor: RED },
          { cells: ["GDD (72h)", "0.0", "> 5", "Low", "Growth stalled."] },
        ] },
        { kind: "progress-bar", label: "Root Zone", value: "20.2%", percent: 20, fillColor: RED, rangeLabels: ["0%", "100%"] },
        { kind: "divider", color: [0.42, 0.44, 0.47] as RGB },
        { kind: "text", style: "caption", text: "Data sources: imagery-weather-derived-v1 · open-meteo" },
      ];

      const result = render(blocks, "Field Report: Biehn");
      assert.ok(result.metadata.pageCount >= 1);
      assert.ok(result.metadata.byteSize > 10000, "Full report should be substantial");
      const text = pdfText(result.bytes);
      assert.ok(text.includes("/Title"), "Should have title in PDF info");
    });
  });
});
