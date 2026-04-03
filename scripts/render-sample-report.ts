#!/usr/bin/env -S node --import tsx
/**
 * Render a sample field report PDF to verify stylesheet changes.
 * Usage: node --import tsx scripts/render-sample-report.ts
 */
import { writeFileSync } from "node:fs";
import { renderPdfDocument, type PdfBlock, type RGB, STATUS, BRAND, SURFACE } from "../packages/pdf/src/index";

const RED: RGB = STATUS.critical;
const GREEN: RGB = BRAND.forest900;
const AMBER: RGB = STATUS.warning;

const blocks: PdfBlock[] = [
  // ── PAGE 1: COVER ──
  { kind: "text", style: "title", text: "Biehn" },
  { kind: "text", style: "subheading", text: "Field Report — Apr 2, 2026" },
  { kind: "spacer", height: 12 },
  { kind: "status-badge", label: "2 Active Alerts", color: RED },
  { kind: "spacer", height: 12 },

  { kind: "key-value", pairs: [
    { key: "Crop", value: "Canola" },
    { key: "Growth Stage", value: "Rosette" },
    { key: "Field Size", value: "259.0 ha" },
    { key: "Legal Land", value: "NW-25-010-17 W4M" },
  ], columns: 2 },

  { kind: "metric-strip", cells: [
    { label: "Root Zone", value: "20.2%", valueColor: RED },
    { label: "Surface", value: "12.3%" },
    { label: "Temperature", value: "-6.4°C", valueColor: RED },
    { label: "Wind", value: "21 km/h" },
    { label: "Precipitation", value: "0.0 mm" },
  ] },

  { kind: "metric-grid", cells: [
    { label: "Active Alerts", value: "2", valueColor: RED },
    { label: "Findings", value: "3", valueColor: AMBER },
    { label: "Tracked Zones", value: "5" },
    { label: "Active Zones", value: "2", valueColor: AMBER },
  ], columns: 4 },

  { kind: "section-header", label: "Action Required", meta: "2 items", accentColor: RED },
  { kind: "severity-card", severity: "critical", title: "HIGH moisture stress: 24 mapped cells are below the monitor threshold",
    body: "Root zone moisture has fallen below 25% across 24 mapped cells. Crops in affected zones may exhibit early wilting symptoms.",
    detail: "Cell average root zone: 18.4%. Monitor threshold: 25%. Last satellite pass 3h ago.",
    action: "Review irrigation scheduling. Prioritize the NW quadrant first." },
  { kind: "severity-card", severity: "warning", title: "Frost risk — overnight low forecast -11.4°C",
    body: "Hard frost conditions expected. Canola at rosette stage is vulnerable to crown damage below -8°C.",
    action: "Check frost protection measures. Monitor overnight low temperatures closely." },

  // ── PAGE 2: MOISTURE & WEATHER ──
  { kind: "section-header", label: "Moisture Conditions", meta: "Apr 2, 2026" },
  { kind: "metric-grid", cells: [
    { label: "Root Zone", value: "20.2%", sub: "Field avg 22.1%", valueColor: RED },
    { label: "Surface", value: "12.3%", sub: "Field avg 14.7%" },
    { label: "Confidence", value: "Medium", sub: "4 low-confidence cells" },
    { label: "Mapped Cells", value: "48", sub: "Range 15.2% – 31.4%" },
  ], columns: 4 },

  { kind: "progress-bar", label: "Root Zone Moisture", value: "22.1%", percent: 22, fillColor: RED, rangeLabels: ["0%", "100%"] },
  { kind: "progress-bar", label: "Surface Moisture", value: "14.7%", percent: 15, fillColor: RED, rangeLabels: ["0%", "100%"] },

  { kind: "text", style: "caption", text: "Cell-level moisture breakdown across 48 mapped cells:" },
  { kind: "table", columns: [
    { label: "Confidence", width: 0.14 },
    { label: "Cells", width: 0.10, align: "right" },
    { label: "Avg Root Zone", width: 0.16, align: "right" },
    { label: "Avg Surface", width: 0.16, align: "right" },
    { label: "Notes", width: 0.44 },
  ], headerBg: GREEN, rows: [
    { cells: ["High", "32", "23.4%", "15.1%", "Within acceptable range for most crops."] },
    { cells: ["Medium", "12", "19.8%", "12.0%", "Below optimal. Monitor for stress signs."], accentColor: AMBER },
    { cells: ["Low", "4", "16.2%", "9.8%", "Low-confidence cells. Verify with in-field probe."], accentColor: RED },
    { cells: ["All Cells", "48", "22.1%", "14.7%", "Range: 15.2% – 31.4% root zone"] },
  ] },

  { kind: "section-header", label: "Weather Observations", meta: "Apr 2, 2026 06:00" },
  { kind: "metric-grid", cells: [
    { label: "Temperature", value: "-6.4°C", valueColor: RED },
    { label: "Precipitation", value: "0.0 mm" },
    { label: "Wind Speed", value: "21.0 km/h" },
    { label: "Humidity", value: "82.0%" },
  ], columns: 4 },

  { kind: "section-header", label: "Weather Signal Assessment", meta: "Apr 2, 2026" },
  { kind: "table", columns: [
    { label: "Signal", width: 0.20 },
    { label: "Value", width: 0.13, align: "right" },
    { label: "Threshold", width: 0.13 },
    { label: "Status", width: 0.10 },
    { label: "Notes", width: 0.44 },
  ], headerBg: GREEN, rows: [
    { cells: ["Crop Water Demand", "0.06 kPa", "0.4 – 1.5 kPa", "Low", "Low crop water demand. Fungal disease risk elevated."] },
    { cells: ["Peak VPD (24h)", "0.10 kPa", "< 2.0 kPa", "OK", "Peak crop water demand is within range."] },
    { cells: ["Water Balance (24h)", "+1.2 mm", "> -5 mm", "OK", "Positive balance. Adequate moisture supply."] },
    { cells: ["Water Balance (72h)", "-2.1 mm", "> -10 mm", "OK", "3-day balance is positive."] },
    { cells: ["Frost Risk Min", "-11.4°C", "> 2°C", "Risk", "Hard frost. Significant crop damage risk."], accentColor: RED },
    { cells: ["Leaf Wet Hours", "8 h", "< 6 h", "Watch", "Moderate leaf wetness. Scout for disease."], accentColor: AMBER },
    { cells: ["Spray Windows", "1", "> 2", "Limited", "Limited windows. Plan applications carefully."], accentColor: AMBER },
    { cells: ["GDD (72h)", "0.0", "> 5", "Low", "Minimal heat accumulation. Growth stalled."] },
    { cells: ["Soil Temp (6 cm)", "-2.1°C", "≥ 7°C", "Cold", "Below seeding threshold. Canola needs sustained ≥7°C at seed depth."], accentColor: AMBER },
  ] },

  // Frost risk progress bar
  { kind: "progress-bar", label: "Frost Risk", value: "-11.4°C", percent: 0, fillColor: RED, rangeLabels: ["-4°C", ">-2°C"] },

  // ── FROST & SPRING RISK (expanded) ──
  { kind: "section-header", label: "Frost & Spring Risk", meta: "7-day outlook" },
  { kind: "metric-grid", cells: [
    { label: "7-Day Low", value: "-11.4°C", sub: "Hard frost expected this week", valueColor: RED },
    { label: "Frost Probability", value: "78%", sub: "Very likely — delay sensitive operations", valueColor: RED },
    { label: "Frost-Risk Nights", value: "5 of 7", sub: "Persistent frost pattern — not safe for tender seedlings", valueColor: RED },
    { label: "Freeze-Thaw Cycles", value: "3", sub: "Soil structure at risk — crusting possible after seeding", valueColor: AMBER },
  ], columns: 4 },
  { kind: "progress-bar", label: "7-Day Frost Probability", value: "78%", percent: 78, fillColor: RED, rangeLabels: ["0%", "100%"] },

  // ── SEEDING INTELLIGENCE ──
  { kind: "section-header", label: "Seeding Intelligence", meta: "Canola — 7°C min" },
  { kind: "metric-grid", cells: [
    { label: "Soil Temp (6 cm)", value: "-2.1°C", sub: "Below 7°C — too cold for Canola", valueColor: RED },
    { label: "Days Sustained", value: "0 days", sub: "Need 3+ consecutive days above threshold", valueColor: AMBER },
    { label: "Field Access", value: "Marginal", sub: "Caution: 3 freeze-thaw cycles. Scout field edges before committing equipment.", valueColor: AMBER },
  ], columns: 3 },

  { kind: "severity-card", severity: "critical",
    title: "Too Early to Seed — Canola",
    body: "Soil at 6 cm is -2.1°C — Canola needs sustained ≥7°C. Wait for warmer conditions.",
    action: "Wait for sustained warming. Track soil temperature daily." },

  { kind: "progress-bar", label: "Soil Temperature vs 7°C Seeding Minimum", value: "-2.1°C", percent: 0, fillColor: RED, rangeLabels: ["0°C", "14°C"] },

  // ── GDD ACCUMULATION ──
  { kind: "section-header", label: "Growing Degree Days", meta: "Season tracker" },
  { kind: "metric-grid", cells: [
    { label: "Season Total", value: "0", sub: "Early season — emergence stage for most crops" },
    { label: "Last 24 h", value: "0.0", sub: "Near-zero accumulation — cold stall", valueColor: AMBER },
    { label: "Last 72 h", value: "0.0", sub: "Minimal heat units — growth essentially paused", valueColor: AMBER },
    { label: "Base Temp", value: "5°C", sub: "GDD = max(0, avg daily temp − 5°C)" },
  ], columns: 4 },
  { kind: "progress-bar", label: "Season GDD Progress", value: "0 / ~1200", percent: 0, fillColor: GREEN as unknown as RGB, rangeLabels: ["0", "1200"] },

  // ── PAGE 3: FORECAST ──
  { kind: "section-header", label: "Forecast", meta: "Next 7 periods" },
  { kind: "table", columns: [
    { label: "Time", width: 0.18 },
    { label: "Conditions", width: 0.16 },
    { label: "Min", width: 0.09, align: "right" },
    { label: "Max", width: 0.09, align: "right" },
    { label: "Precip", width: 0.14, align: "right" },
    { label: "Wind", width: 0.14, align: "right" },
    { label: "Chance", width: 0.12, align: "right" },
  ], headerBg: GREEN, rows: [
    { cells: ["Apr 2", "Frost risk", "-11.4°", "-6.0°", "0.0 mm", "21 km/h", "5%"], accentColor: RED },
    { cells: ["Apr 3", "Deep frost", "-10.2°", "-3.0°", "0.0 mm", "15 km/h", "2%"], accentColor: RED },
    { cells: ["Apr 4", "Frost risk", "-4.0°", "2.5°", "0.5 mm", "12 km/h", "30%"] },
    { cells: ["Apr 5", "Light rain", "-1.0°", "5.0°", "3.2 mm", "18 km/h", "65%"] },
    { cells: ["Apr 6", "Chance of showers", "1.0°", "8.0°", "1.5 mm", "10 km/h", "40%"] },
    { cells: ["Apr 7", "Dry", "2.0°", "12.0°", "0.0 mm", "8 km/h", "5%"] },
    { cells: ["Apr 8", "Dry", "4.0°", "14.0°", "0.0 mm", "6 km/h", "3%"] },
  ] },

  { kind: "sparkline", label: "Forecast Precipitation (mm)", data: [0, 0, 0.5, 3.2, 1.5, 0, 0], color: [0.23, 0.51, 0.85] as RGB, height: 48 },
  { kind: "multi-sparkline", label: "Forecast Temperature Window (°C)", series: [
    { label: "High", data: [-6, -3, 2.5, 5, 8, 12, 14], color: RED },
    { label: "Low", data: [-11.4, -10.2, -4, -1, 1, 2, 4], color: [0.23, 0.51, 0.85] as RGB },
  ], height: 56 },

  // ── PAGE 4: ALERTS & FINDINGS ──
  { kind: "section-header", label: "Alerts", meta: "2 active" },
  { kind: "severity-card", severity: "critical", title: "HIGH moisture stress: 24 mapped cells are below the monitor threshold",
    body: "Root zone moisture has fallen below 25% across 24 mapped cells.",
    detail: "Cell average root zone: 18.4%. Monitor threshold: 25%.",
    action: "Review irrigation scheduling. Prioritize the NW quadrant first." },
  { kind: "severity-card", severity: "warning", title: "Frost risk — overnight low forecast -11.4°C",
    body: "Hard frost conditions expected overnight.",
    action: "Check frost protection measures." },

  { kind: "section-header", label: "Intelligence Findings", meta: "3 active" },
  { kind: "text", style: "caption", text: "NocPulse intelligence combines satellite, weather, and crop models to detect issues early." },
  { kind: "severity-card", severity: "critical", title: "Moisture deficit accelerating across western cells",
    body: "Satellite-derived moisture estimates show a 4% week-over-week decline in the western half of the field.",
    detail: "8 cells affected. Western boundary cells showing fastest decline.",
    action: "Ground-truth stressed zones within the next 48 hours." },
  { kind: "severity-card", severity: "warning", title: "Disease pressure rising with extended leaf wetness",
    body: "Warm humid conditions combined with 8h leaf wetness create favorable environment for Leptosphaeria.",
    action: "Scout canopy-dense zones for early blackleg symptoms." },
  { kind: "severity-card", severity: "info", title: "Spray window available tomorrow 10:00–14:00",
    body: "Wind speed forecast drops below 15 km/h with no precipitation expected.",
    action: "Schedule fungicide application if blackleg risk confirms." },

  { kind: "section-header", label: "Tracked Zones", meta: "5 total" },
  { kind: "metric-grid", cells: [
    { label: "New", value: "1", valueColor: RED },
    { label: "Persistent", value: "2", valueColor: AMBER },
    { label: "Recovering", value: "1" },
    { label: "Resolved", value: "1" },
  ], columns: 4 },

  { kind: "table", columns: [
    { label: "Type", width: 0.20 },
    { label: "Status", width: 0.14 },
    { label: "Severity", width: 0.14 },
    { label: "Cells", width: 0.12, align: "right" },
    { label: "First Seen", width: 0.20 },
    { label: "Last Seen", width: 0.20 },
  ], headerBg: GREEN, rows: [
    { cells: ["moisture stress", "new", "high", "8", "Apr 1, 2026", "Apr 2, 2026"], accentColor: RED },
    { cells: ["moisture stress", "persistent", "medium", "12", "Mar 28, 2026", "Apr 2, 2026"], accentColor: AMBER },
    { cells: ["frost damage", "persistent", "medium", "6", "Mar 30, 2026", "Apr 2, 2026"], accentColor: AMBER },
    { cells: ["canopy decline", "recovering", "low", "4", "Mar 25, 2026", "Apr 1, 2026"] },
    { cells: ["waterlogging", "resolved", "low", "2", "Mar 20, 2026", "Mar 28, 2026"] },
  ] },

  // ── FOOTER: PROVENANCE ──
  { kind: "spacer", height: 12 },
  { kind: "divider", color: SURFACE.border as unknown as RGB, thickness: 0.5 },
  { kind: "section-header", label: "Data Sources & Provenance" },
  { kind: "key-value", pairs: [
    { key: "Moisture data", value: "Apr 2, 2026, 03:15 AM" },
    { key: "Weather data", value: "Apr 2, 2026, 06:00 AM" },
    { key: "Field location", value: "52.14500, -110.98300" },
    { key: "Report date", value: "Apr 2, 2026" },
  ], columns: 2 },
  { kind: "spacer", height: 12 },
  { kind: "text", style: "caption", text: "This report was generated by NocPulse and reflects conditions at the time of data collection. Always verify critical decisions with on-ground observation." },
];

const result = renderPdfDocument({
  artifactKey: "sample/biehn-field-report-v3.pdf",
  title: "Field Report: Biehn",
  subject: "NocPulse field report for Biehn — 2026-04-02",
  author: "NocPulse",
  blocks,
});

const outPath = process.argv[2] ?? "biehn-field-report-v3.pdf";
writeFileSync(outPath, result.bytes);
console.log(`Rendered ${result.metadata.pageCount} pages, ${result.metadata.byteSize} bytes → ${outPath}`);
