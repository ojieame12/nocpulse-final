/**
 * Color system for FieldDetailPanel.
 *
 * Ramp-derived palette + severity color tables + contextual color helpers.
 * Extracted from FieldDetailPanel.tsx — no behavior change.
 */

import {
  resolveRampColor,
  type FieldAgronomicSurfaceMetricKey,
} from "@fieldpulse/map";
import type { SeverityKey, DetailPanelModeVital } from "./fieldDetailTypes";

/* ── Ramp-derived palette — matches map extrusion colors exactly ── */

/** Convert metric key + value to an RGB accent color from the map's color ramp */
export function resolveRampAccent(
  metricKey: FieldAgronomicSurfaceMetricKey,
  valuePct: number | null,
  isDark: boolean,
): { accent: string; tint: string; deep: string } {
  const pct = valuePct ?? 50; // fallback to mid-ramp
  const [r, g, b] = resolveRampColor(metricKey, pct);
  if (isDark) {
    // Lighten slightly for dark backgrounds, keep vivid
    const lr = Math.min(255, r + 40);
    const lg = Math.min(255, g + 40);
    const lb = Math.min(255, b + 40);
    return {
      accent: `rgba(${lr},${lg},${lb},0.85)`,
      tint: `rgba(${r},${g},${b},0.08)`,
      deep: `rgba(${r},${g},${b},0.45)`,
    };
  }
  return {
    accent: `rgb(${r},${g},${b})`,
    tint: `rgba(${r},${g},${b},0.06)`,
    deep: `rgba(${Math.round(r * 0.6)},${Math.round(g * 0.6)},${Math.round(b * 0.6)})`,
  };
}

/** Resolve a solid RGB string from the ramp (for SVG strokes, donut arcs, etc.) */
export function resolveRampSolid(
  metricKey: FieldAgronomicSurfaceMetricKey,
  valuePct: number | null,
): string {
  const pct = valuePct ?? 50;
  const [r, g, b] = resolveRampColor(metricKey, pct);
  return `rgb(${r},${g},${b})`;
}

/* ── Severity color system — cascading contextual colors ── */

export const SEV_COLORS_LIGHT: Record<SeverityKey, { text: string; bg: string; gradient: string; ring: string }> = {
  positive: {
    text: "#16a34a",
    bg: "rgba(22,163,74,0.06)",
    gradient: "linear-gradient(160deg, rgba(22,163,74,0.08) 0%, rgba(22,163,74,0.01) 100%)",
    ring: "#16a34a",
  },
  warning: {
    text: "#d97706",
    bg: "rgba(245,158,11,0.06)",
    gradient: "linear-gradient(160deg, rgba(245,158,11,0.08) 0%, rgba(245,158,11,0.01) 100%)",
    ring: "#f59e0b",
  },
  danger: {
    text: "#dc2626",
    bg: "rgba(239,68,68,0.06)",
    gradient: "linear-gradient(160deg, rgba(239,68,68,0.08) 0%, rgba(239,68,68,0.01) 100%)",
    ring: "#ef4444",
  },
};

export const SEV_COLORS_DARK: Record<SeverityKey, { text: string; bg: string; gradient: string; ring: string }> = {
  positive: {
    text: "rgba(74,222,128,0.85)",
    bg: "rgba(74,222,128,0.05)",
    gradient: "linear-gradient(160deg, rgba(74,222,128,0.10) 0%, rgba(74,222,128,0.02) 100%)",
    ring: "rgba(74,222,128,0.7)",
  },
  warning: {
    text: "rgba(252,211,77,0.85)",
    bg: "rgba(252,211,77,0.05)",
    gradient: "linear-gradient(160deg, rgba(252,211,77,0.10) 0%, rgba(252,211,77,0.02) 100%)",
    ring: "rgba(252,211,77,0.7)",
  },
  danger: {
    text: "rgba(252,165,165,0.85)",
    bg: "rgba(252,165,165,0.05)",
    gradient: "linear-gradient(160deg, rgba(252,165,165,0.10) 0%, rgba(252,165,165,0.02) 100%)",
    ring: "rgba(252,165,165,0.7)",
  },
};

/** Resolve severity-aware accent color — blends mode accent with severity signal */
export function resolveSeverityAccent(
  modeAccent: string,
  sev: SeverityKey,
  isDark: boolean,
): string {
  if (sev === "positive") return modeAccent; // healthy = mode color
  const sevColors = isDark ? SEV_COLORS_DARK : SEV_COLORS_LIGHT;
  return sevColors[sev].text;
}

/** Resolve the hero donut ring color — mode-colored when healthy, severity-colored when stressed */
export function resolveHeroRingColor(
  modeAccent: string,
  sev: SeverityKey,
  isDark: boolean,
): string {
  if (sev === "positive") return modeAccent;
  const sevColors = isDark ? SEV_COLORS_DARK : SEV_COLORS_LIGHT;
  return sevColors[sev].ring;
}

/** Get contextual card background gradient for a given severity */
export function sevCardGradient(sev: SeverityKey | null, isDark: boolean): string | undefined {
  if (!sev || sev === "positive") return undefined;
  return isDark ? SEV_COLORS_DARK[sev].gradient : SEV_COLORS_LIGHT[sev].gradient;
}

/** Determine per-vital severity from the vital's own data */
export function resolveVitalSeverity(vital: DetailPanelModeVital): SeverityKey | null {
  if (vital.sev && vital.icon === "down") return "danger";
  if (vital.sev) return "warning";
  return null;
}

/** Get a vital's contextual text color */
export function vitalValueColor(vital: DetailPanelModeVital, modeAccent: string, isDark: boolean): string | undefined {
  const sev = resolveVitalSeverity(vital);
  if (!sev) return modeAccent;
  return isDark ? SEV_COLORS_DARK[sev].text : SEV_COLORS_LIGHT[sev].text;
}
