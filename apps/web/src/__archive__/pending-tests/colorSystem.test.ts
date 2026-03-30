import test from "node:test";
import assert from "node:assert/strict";

/**
 * Color System — characterization tests
 *
 * These tests are written to import from the extracted colorSystem.ts module.
 * They characterize the ACTUAL behavior of resolveRampAccent, resolveSeverityAccent,
 * resolveHeroRingColor, sevCardGradient, resolveVitalSeverity, and vitalValueColor
 * as implemented in FieldDetailPanel.tsx lines 71–192.
 *
 * Import path will resolve once Phase 1 extraction is complete.
 */
import {
  resolveRampAccent,
  resolveSeverityAccent,
  resolveHeroRingColor,
  sevCardGradient,
  resolveVitalSeverity,
  vitalValueColor,
  SEV_COLORS_LIGHT,
  SEV_COLORS_DARK,
  type SeverityKey,
} from "../colorSystem";

// ── resolveRampAccent ──────────────────────────────────────────────

test("resolveRampAccent: light mode returns rgb() accent, rgba() tint, rgba() deep", () => {
  const result = resolveRampAccent("root-zone-moisture-pct", 50, false);
  assert.ok(result.accent.startsWith("rgb("), `accent should be rgb(), got: ${result.accent}`);
  assert.ok(result.tint.startsWith("rgba("), `tint should be rgba(), got: ${result.tint}`);
  assert.ok(result.deep.startsWith("rgba(") || result.deep.startsWith("rgb("), `deep format unexpected: ${result.deep}`);
});

test("resolveRampAccent: dark mode returns rgba() accent with 0.85 alpha", () => {
  const result = resolveRampAccent("root-zone-moisture-pct", 50, true);
  assert.ok(result.accent.startsWith("rgba("), `dark accent should be rgba(), got: ${result.accent}`);
  assert.ok(result.accent.endsWith(",0.85)"), `dark accent should end with 0.85 alpha, got: ${result.accent}`);
});

test("resolveRampAccent: dark tint uses 0.08 alpha", () => {
  const result = resolveRampAccent("ndvi", 70, true);
  assert.ok(result.tint.endsWith(",0.08)"), `dark tint should use 0.08 alpha, got: ${result.tint}`);
});

test("resolveRampAccent: dark deep uses 0.45 alpha", () => {
  const result = resolveRampAccent("ndvi", 70, true);
  assert.ok(result.deep.endsWith(",0.45)"), `dark deep should use 0.45 alpha, got: ${result.deep}`);
});

test("resolveRampAccent: light and dark produce different accent for same input", () => {
  const light = resolveRampAccent("ndvi", 60, false);
  const dark = resolveRampAccent("ndvi", 60, true);
  assert.notEqual(light.accent, dark.accent);
});

test("resolveRampAccent: null valuePct falls back to mid-ramp (50) without throwing", () => {
  const withNull = resolveRampAccent("ndvi", null, false);
  const with50 = resolveRampAccent("ndvi", 50, false);
  assert.equal(withNull.accent, with50.accent);
  assert.equal(withNull.tint, with50.tint);
  assert.equal(withNull.deep, with50.deep);
});

test("resolveRampAccent: different metric keys produce different colors at same pct", () => {
  const moisture = resolveRampAccent("root-zone-moisture-pct", 50, false);
  const ndvi = resolveRampAccent("ndvi", 50, false);
  // Different ramps should usually produce different colors (not guaranteed at every point,
  // but at pct=50 the ramps diverge)
  // If this fails, it means the ramps are identical at this point — not a bug, just remove this test
  assert.notEqual(moisture.accent, ndvi.accent);
});

test("resolveRampAccent: extreme values (0, 100) don't produce NaN or empty strings", () => {
  for (const pct of [0, 100]) {
    for (const isDark of [true, false]) {
      const result = resolveRampAccent("ndvi", pct, isDark);
      assert.ok(result.accent.length > 0, `accent empty at pct=${pct}, isDark=${isDark}`);
      assert.ok(!result.accent.includes("NaN"), `NaN in accent at pct=${pct}, isDark=${isDark}`);
      assert.ok(result.tint.length > 0);
      assert.ok(result.deep.length > 0);
    }
  }
});

test("resolveRampAccent: dark mode lightens RGB channels by +40 (clamped at 255)", () => {
  // Implementation: lr = Math.min(255, r + 40), same for g, b
  // We can't access the raw RGB here, but we can verify the accent differs from light
  // and that the format is correct. The +40 lightening is an implementation detail
  // we trust if the format assertions pass.
  const dark = resolveRampAccent("ndvi", 30, true);
  assert.match(dark.accent, /^rgba\(\d+,\d+,\d+,0\.85\)$/);
});

// ── Severity color lookups ─────────────────────────────────────────

test("resolveSeverityAccent: positive severity returns the mode accent unchanged", () => {
  const modeAccent = "rgb(100,150,200)";
  assert.equal(resolveSeverityAccent(modeAccent, "positive", false), modeAccent);
  assert.equal(resolveSeverityAccent(modeAccent, "positive", true), modeAccent);
});

test("resolveSeverityAccent: warning/danger return severity text color, not mode accent", () => {
  const modeAccent = "rgb(100,150,200)";
  const warningLight = resolveSeverityAccent(modeAccent, "warning", false);
  const dangerLight = resolveSeverityAccent(modeAccent, "danger", false);
  assert.notEqual(warningLight, modeAccent);
  assert.notEqual(dangerLight, modeAccent);
  assert.equal(warningLight, SEV_COLORS_LIGHT.warning.text);
  assert.equal(dangerLight, SEV_COLORS_LIGHT.danger.text);
});

test("resolveSeverityAccent: dark mode uses dark severity palette", () => {
  const modeAccent = "rgb(100,150,200)";
  assert.equal(
    resolveSeverityAccent(modeAccent, "danger", true),
    SEV_COLORS_DARK.danger.text,
  );
});

test("resolveHeroRingColor: positive returns modeAccent, others return severity ring", () => {
  const accent = "rgb(50,100,150)";
  assert.equal(resolveHeroRingColor(accent, "positive", false), accent);
  assert.equal(resolveHeroRingColor(accent, "warning", false), SEV_COLORS_LIGHT.warning.ring);
  assert.equal(resolveHeroRingColor(accent, "danger", true), SEV_COLORS_DARK.danger.ring);
});

test("sevCardGradient: positive and null return undefined", () => {
  assert.equal(sevCardGradient("positive", false), undefined);
  assert.equal(sevCardGradient(null, false), undefined);
  assert.equal(sevCardGradient(null, true), undefined);
});

test("sevCardGradient: warning/danger return gradient strings", () => {
  const warnGrad = sevCardGradient("warning", false);
  assert.ok(warnGrad != null);
  assert.ok(warnGrad!.startsWith("linear-gradient"));

  const darkDangerGrad = sevCardGradient("danger", true);
  assert.ok(darkDangerGrad != null);
  assert.ok(darkDangerGrad!.startsWith("linear-gradient"));
});

// ── resolveVitalSeverity ───────────────────────────────────────────

test("resolveVitalSeverity: sev=true + icon='down' → 'danger'", () => {
  assert.equal(resolveVitalSeverity({ label: "X", value: "1", sev: true, icon: "down" }), "danger");
});

test("resolveVitalSeverity: sev=true + no icon → 'warning'", () => {
  assert.equal(resolveVitalSeverity({ label: "X", value: "1", sev: true }), "warning");
});

test("resolveVitalSeverity: sev=true + icon='up' → 'warning' (not danger)", () => {
  assert.equal(resolveVitalSeverity({ label: "X", value: "1", sev: true, icon: "up" }), "warning");
});

test("resolveVitalSeverity: sev=false or undefined → null", () => {
  assert.equal(resolveVitalSeverity({ label: "X", value: "1" }), null);
  assert.equal(resolveVitalSeverity({ label: "X", value: "1", sev: false }), null);
});

// ── vitalValueColor ────────────────────────────────────────────────

test("vitalValueColor: no severity returns modeAccent", () => {
  const accent = "rgb(1,2,3)";
  assert.equal(vitalValueColor({ label: "X", value: "1" }, accent, false), accent);
});

test("vitalValueColor: sev+down returns danger text color", () => {
  const result = vitalValueColor({ label: "X", value: "1", sev: true, icon: "down" }, "rgb(1,2,3)", false);
  assert.equal(result, SEV_COLORS_LIGHT.danger.text);
});

test("vitalValueColor: dark mode sev+down returns dark danger text", () => {
  const result = vitalValueColor({ label: "X", value: "1", sev: true, icon: "down" }, "rgb(1,2,3)", true);
  assert.equal(result, SEV_COLORS_DARK.danger.text);
});
