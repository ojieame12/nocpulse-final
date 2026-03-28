"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { CellHoverEvent, FieldAgronomicSurfaceMetricKey } from "@fieldpulse/map";

/* ============================================================
   FieldPulse V3 — Cell Tooltip
   ============================================================
   Three-tier editorial tooltip, matched to V1 MapTooltip layout:

   ┌──────────────────────────────────┐
   │  CELL R3 · C7                    │  ← title (uppercase mono)
   │  Root Moisture                   │  ← subtitle (metric label)
   │  64.2%                           │  ← hero: 28px serif
   │  +4.2% vs avg · improving       │  ← context
   │  ┌──────┐ ┌────┐ ┌──────┐      │
   │  │σ med │ │92% │ │SAR   │      │  ← stat pill badges
   │  └──────┘ └────┘ └──────┘      │
   │  ─────────────────────────────── │  ← border-top
   │  fresh-sar · healthy             │  ← meta (muted)
   └──────────────────────────────────┘

   Glass surface:  rgba(12,18,14,0.82) + blur(12px)
   Border:         rgba(255,255,255,0.12)
   Border radius:  20px
   Shadow:         0 16px 34px rgba(0,0,0,0.18)
   Max width:      260px
   Enter:          150ms scale(0.92) spring
   Exit:           120ms scale(0.88) fade
   ============================================================ */

type CellTooltipProps = {
  hover: CellHoverEvent | null;
};

/* ── Constants ── */

const ENTER_MS = 180;
const EXIT_MS = 140;
const TOOLTIP_WIDTH = 260;
const TOOLTIP_EST_HEIGHT = 180; // approximate max height for clamping
const CURSOR_OFFSET_X = 18;
const CURSOR_OFFSET_Y = 14;
const VIEWPORT_MARGIN = 12;

/* ── Metric display ── */

const METRIC_LABELS: Record<FieldAgronomicSurfaceMetricKey, string> = {
  ndvi: "NDVI",
  ndre: "NDRE",
  ndmi: "NDMI",
  "root-zone-moisture-pct": "Root Moisture",
  "surface-moisture-pct": "Surface Moisture",
};

function formatHeroValue(metricKey: FieldAgronomicSurfaceMetricKey, pct: number): string {
  if (metricKey === "root-zone-moisture-pct" || metricKey === "surface-moisture-pct") {
    return `${pct.toFixed(1)}%`;
  }
  return (pct / 100).toFixed(2);
}

function formatDelta(delta: number): string {
  const abs = Math.abs(delta);
  if (abs < 0.5) return "at avg";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}% vs avg`;
}

function deltaTrend(delta: number): string {
  if (delta > 5) return "↑ above";
  if (delta < -5) return "↓ below";
  return "~ average";
}

/* ── Hero color by metric value ── */

const MOISTURE_COLORS: [number, string][] = [
  [0, "#B91C1C"],
  [30, "#F97316"],
  [55, "#EAB308"],
  [78, "#22C55E"],
  [100, "#0EA5E9"],
];

const INDEX_COLORS: [number, string][] = [
  [0, "#9E9E9E"],
  [15, "#C62828"],
  [32, "#F57C00"],
  [52, "#FBC02D"],
  [75, "#7CB342"],
  [100, "#1B5E20"],
];

function resolveHeroColor(metricKey: FieldAgronomicSurfaceMetricKey, pct: number): string {
  const stops =
    metricKey === "root-zone-moisture-pct" || metricKey === "surface-moisture-pct"
      ? MOISTURE_COLORS
      : INDEX_COLORS;

  // Find the bracket
  for (let i = 0; i < stops.length - 1; i++) {
    if (pct <= stops[i + 1][0]) {
      return stops[i][1]; // snap to lower stop color for simplicity
    }
  }
  return stops[stops.length - 1][1];
}

/* ── Health severity color ── */

function severityColor(label: string | null): string {
  if (label === "healthy") return "#4ADE80";
  if (label === "stressed") return "#FBBF24";
  if (label === "critical") return "#F87171";
  return "rgba(241,245,249,0.38)";
}

/* ── Animation state machine ── */

type AnimState = "entering" | "visible" | "exiting" | "hidden";

/* ── Shared inline style fragments (matches V1 tokens) ── */

const heroValueStyle: CSSProperties = {
  fontFamily: "var(--font-heading, Georgia, serif)",
  fontSize: 28,
  fontWeight: 500,
  lineHeight: 1,
  letterSpacing: "-0.02em",
};

const heroLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  color: "rgba(241,245,249,0.52)",
  lineHeight: 1,
};

const contextStyle: CSSProperties = {
  margin: 0,
  marginTop: 6,
  fontSize: 11,
  color: "rgba(241,245,249,0.74)",
  lineHeight: 1.4,
};

const chipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 20,
  padding: "2px 7px",
  borderRadius: 9999,
  border: "1px solid rgba(255,255,255,0.08)",
  backgroundColor: "rgba(255,255,255,0.06)",
  color: "rgba(248,250,252,0.76)",
  fontSize: 10,
  fontWeight: 600,
  fontFamily: "var(--font-mono, 'IBM Plex Mono', monospace)",
  lineHeight: 1.2,
  letterSpacing: "0.01em",
};

const metaSeparatorStyle: CSSProperties = {
  marginTop: 8,
  paddingTop: 6,
  borderTop: "1px solid rgba(255,255,255,0.08)",
  display: "flex",
  flexWrap: "wrap",
  gap: "2px 8px",
};

const metaTextStyle: CSSProperties = {
  fontSize: 10,
  color: "rgba(241,245,249,0.38)",
  fontWeight: 400,
  lineHeight: 1.5,
};

/* ── Component ── */

export function CellTooltip({ hover }: CellTooltipProps) {
  const [animState, setAnimState] = useState<AnimState>("hidden");
  const [displayHover, setDisplayHover] = useState<CellHoverEvent | null>(null);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (hover) {
      if (exitTimer.current) {
        clearTimeout(exitTimer.current);
        exitTimer.current = null;
      }
      setDisplayHover(hover);
      setAnimState("entering");
      const id = setTimeout(() => setAnimState("visible"), ENTER_MS);
      return () => clearTimeout(id);
    } else if (displayHover) {
      setAnimState("exiting");
      exitTimer.current = setTimeout(() => {
        setAnimState("hidden");
        setDisplayHover(null);
        exitTimer.current = null;
      }, EXIT_MS);
    }
  }, [hover]); // intentionally not including displayHover

  if (animState === "hidden" || !displayHover) return null;

  const h = displayHover;
  const metricLabel = METRIC_LABELS[h.metricKey] ?? h.metricKey;
  const heroValue = formatHeroValue(h.metricKey, h.metricValuePct);
  const heroColor = resolveHeroColor(h.metricKey, h.metricValuePct);
  const contextParts = [formatDelta(h.deltaFromFieldAvgPct), deltaTrend(h.deltaFromFieldAvgPct)];
  const confidencePct = `${Math.round(h.confidence * 100)}%`;

  const animName = animState === "exiting" ? "tooltipExit" : "tooltipEnter";
  const animDuration = animState === "exiting" ? `${EXIT_MS}ms` : `${ENTER_MS}ms`;

  // ── Viewport clamping ──
  // Detect if tooltip would overflow right or bottom edge and flip accordingly
  const vw = typeof window !== "undefined" ? window.innerWidth : 1920;
  const vh = typeof window !== "undefined" ? window.innerHeight : 1080;

  const overflowsRight = h.screenX + CURSOR_OFFSET_X + TOOLTIP_WIDTH + VIEWPORT_MARGIN > vw;
  const overflowsTop = h.screenY - CURSOR_OFFSET_Y - TOOLTIP_EST_HEIGHT < VIEWPORT_MARGIN;

  const tooltipLeft = overflowsRight
    ? h.screenX - CURSOR_OFFSET_X - TOOLTIP_WIDTH
    : h.screenX + CURSOR_OFFSET_X;

  const tooltipTop = overflowsTop
    ? h.screenY + CURSOR_OFFSET_Y + 8
    : Math.max(h.screenY - CURSOR_OFFSET_Y, 120);

  const tooltipTransform = overflowsTop ? "translateY(0)" : "translateY(-100%)";
  const transformOrigin = `${overflowsRight ? "right" : "left"} ${overflowsTop ? "top" : "bottom"}`;

  return (
    <div
      className="cell-tooltip-v3"
      style={{
        position: "absolute",
        left: tooltipLeft,
        top: tooltipTop,
        transform: tooltipTransform,
        pointerEvents: "none",
        zIndex: 20,

        background: "var(--glass-bg, rgba(12, 18, 14, 0.84))",
        backdropFilter: "var(--glass-blur, blur(14px))",
        WebkitBackdropFilter: "var(--glass-blur, blur(14px))",

        borderRadius: 18,
        border: "1px solid var(--glass-border, rgba(255, 255, 255, 0.10))",
        overflow: "hidden",
        maxWidth: TOOLTIP_WIDTH,
        boxShadow: "0 12px 32px rgba(0, 0, 0, 0.22), 0 4px 12px rgba(0, 0, 0, 0.10)",

        animation: `${animName} ${animDuration} var(--ease-out-soft, cubic-bezier(0.22, 1, 0.36, 1)) both`,
        transformOrigin,
        willChange: "transform, opacity, filter",
      }}
    >
      <div style={{ padding: "10px 12px 12px" }}>
        {/* ── Title: cell ID (uppercase mono) ── */}
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-body, sans-serif)",
            fontSize: 10,
            fontWeight: 700,
            color: "rgba(248, 250, 252, 1)",
            lineHeight: 1.3,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          {h.cellId.length > 16 ? h.cellId.slice(0, 8).toUpperCase() : h.cellId.toUpperCase()}
        </p>

        {/* ── Subtitle: metric label ── */}
        <p
          style={{
            margin: 0,
            marginTop: 2,
            fontSize: 10,
            color: "rgba(241,245,249,0.52)",
            fontWeight: 500,
            lineHeight: 1.3,
          }}
        >
          {metricLabel}
        </p>

        {/* ── Hero: large metric value ── */}
        <div style={{ marginTop: 6 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ ...heroValueStyle, color: heroColor, transition: "color 180ms ease-out" }}>{heroValue}</span>
            <span style={heroLabelStyle}>{metricLabel}</span>
          </div>

          {/* ── Context: delta + trend ── */}
          <p style={contextStyle}>{contextParts.join(" · ")}</p>

          {/* ── Stat chips (staggered entrance) ── */}
          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: "6px 6px" }}>
            {[
              `σ ${h.varianceBucket}`,
              confidencePct,
              h.sourceTier.replace(/-/g, " "),
            ].map((label, i) => (
              <span
                key={label}
                style={{
                  ...chipStyle,
                  animation: animState === "entering"
                    ? `chipFadeIn 160ms var(--ease-out-soft, ease-out) ${60 + i * 40}ms both`
                    : undefined,
                }}
              >
                {label}
              </span>
            ))}
          </div>

          {/* ── Meta separator + footer ── */}
          <div style={metaSeparatorStyle}>
            <span style={metaTextStyle}>{h.sourceTier}</span>
            {h.severityLabel ? (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: severityColor(h.severityLabel),
                }}
              >
                {h.severityLabel}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
