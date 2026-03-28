"use client";

import { useState, useMemo, type CSSProperties } from "react";
import type {
  FieldAgronomicSurfaceMetricKey,
  ColorRamp,
} from "@fieldpulse/map";
import { resolveColorRamp } from "@fieldpulse/map";

/* ═══════════════════════════════════════════════════════════
   FieldPulse V3 — Metric Legend Card
   ═══════════════════════════════════════════════════════════
   Matches V1's MapLayerHud info-card pattern:

   ┌──────────────────────────────────────────┐
   │  MOISTURE · Weather-derived model   23%  ▾│  ← header (tap to expand)
   │  ┃████████████████████████████████████┃   │  ← gradient bar
   │  Drier                          Wetter   │  ← semantic labels
   ├──────────────────────────────────────────┤
   │  Expanded section (toggle)               │
   │  Source: fresh-sar · Confidence: high    │
   └──────────────────────────────────────────┘

   Glass surface uses shared CSS custom properties.
   ═══════════════════════════════════════════════════════════ */

/* ── Glass tokens (match V1's MapLayerHud) ── */

const GLASS_BG = "var(--glass-bg, rgba(12,18,14,0.84))";
const GLASS_BORDER = "var(--glass-border, rgba(255,255,255,0.10))";
const GLASS_BLUR = "var(--glass-blur, blur(14px))";
const GLASS_SHADOW = "0 12px 32px rgba(0,0,0,0.22), 0 4px 12px rgba(0,0,0,0.10)";
const GLASS_TEXT = "#F8FAFC";
const GLASS_MUTED = "rgba(216,239,226,0.72)";
const GLASS_LABEL = "rgba(241,245,249,0.78)";
const GLASS_DIM = "rgba(226,232,240,0.6)";

/* ── Metric metadata ── */

type MetricMeta = {
  label: string;
  description: string;
  startLabel: string;
  endLabel: string;
};

const METRIC_META: Record<FieldAgronomicSurfaceMetricKey, MetricMeta> = {
  "root-zone-moisture-pct": {
    label: "Moisture",
    description: "Weather-derived field moisture model",
    startLabel: "Drier",
    endLabel: "Wetter",
  },
  "surface-moisture-pct": {
    label: "Surface",
    description: "Surface-level moisture estimate",
    startLabel: "Drier",
    endLabel: "Wetter",
  },
  ndvi: {
    label: "NDVI",
    description: "Normalized vegetation index — canopy health",
    startLabel: "Bare",
    endLabel: "Dense",
  },
  ndre: {
    label: "NDRE",
    description: "Red-edge index — chlorophyll sensitivity",
    startLabel: "Low",
    endLabel: "High",
  },
  ndmi: {
    label: "NDMI",
    description: "Moisture infrared — leaf water content",
    startLabel: "Dry",
    endLabel: "Wet",
  },
};

/* ── Gradient CSS from ColorRamp ── */

function rampToGradient(ramp: ColorRamp): string {
  const stops = ramp.map(
    ([pct, [r, g, b]]) => `rgb(${r},${g},${b}) ${pct}%`,
  );
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}

/* ── Props ── */

export type MetricLegendCardProps = {
  metricKey: FieldAgronomicSurfaceMetricKey;
  metricAveragePct: number | null;
  confidence?: "low" | "medium" | "high";
  sourceLabel?: string;
  /** Cross-fade opacity driven by parent (0→1) */
  fadeOpacity?: number;
};

/* ── Component ── */

export function MetricLegendCard({
  metricKey,
  metricAveragePct,
  confidence,
  sourceLabel,
  fadeOpacity = 1,
}: MetricLegendCardProps) {
  const [expanded, setExpanded] = useState(false);

  const meta = METRIC_META[metricKey];
  const ramp = resolveColorRamp(metricKey);
  const gradient = useMemo(() => rampToGradient(ramp), [ramp]);

  const displayValue =
    metricAveragePct !== null ? `${Math.round(metricAveragePct)}%` : "—";

  return (
    <div
      className="metric-legend-card"
      style={{
        position: "absolute",
        top: 52,
        left: 12,
        zIndex: 14,
        width: 240,
        borderRadius: 14,
        border: `1px solid ${GLASS_BORDER}`,
        background: GLASS_BG,
        backdropFilter: GLASS_BLUR,
        WebkitBackdropFilter: GLASS_BLUR,
        boxShadow: GLASS_SHADOW,
        overflow: "hidden",
        opacity: fadeOpacity,
        transition: "opacity 300ms cubic-bezier(0.22,1,0.36,1)",
        willChange: "opacity",
        animation: "legendCardEnter 350ms var(--ease-out-soft, cubic-bezier(0.22,1,0.36,1)) both",
      }}
    >
      {/* ── Header row (tap to expand) ── */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: "10px 14px",
          border: "none",
          backgroundColor: "transparent",
          cursor: "pointer",
          gap: 8,
        }}
      >
        <div style={{ textAlign: "left", flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: 9,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: GLASS_MUTED,
              fontWeight: 700,
              fontFamily: "var(--font-body, 'Sintony', sans-serif)",
            }}
          >
            {meta.label} · {meta.description}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <span
            style={{
              fontSize: 18,
              fontFamily: "var(--font-heading, Georgia, serif)",
              color: GLASS_TEXT,
              fontWeight: 400,
              transition: "color 180ms ease-out",
            }}
          >
            {displayValue}
          </span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke={GLASS_MUTED}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 250ms cubic-bezier(0.22,1,0.36,1)",
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {/* ── Gradient bar + semantic labels (always visible) ── */}
      <div style={{ padding: "0 14px 10px" }}>
        <div
          style={{
            height: 8,
            borderRadius: 999,
            background: gradient,
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.10)",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            marginTop: 4,
          }}
        >
          <span style={{ fontSize: 9, color: GLASS_LABEL, fontWeight: 700 }}>
            {meta.startLabel}
          </span>
          <span style={{ fontSize: 9, color: GLASS_LABEL, fontWeight: 700 }}>
            {meta.endLabel}
          </span>
        </div>
      </div>

      {/* ── Expandable detail section ── */}
      <div
        style={{
          maxHeight: expanded ? 120 : 0,
          opacity: expanded ? 1 : 0,
          overflow: "hidden",
          transition:
            "max-height 350ms cubic-bezier(0.22,1,0.36,1), opacity 250ms cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        <div
          style={{
            borderTop: `1px solid ${GLASS_BORDER}`,
            padding: "10px 14px",
            display: "flex",
            flexWrap: "wrap",
            gap: "4px 12px",
          }}
        >
          {confidence ? (
            <MetaChip label="Confidence" value={confidence} />
          ) : null}
          {sourceLabel ? (
            <MetaChip label="Source" value={sourceLabel.replace(/-/g, " ")} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ── Tiny meta chip ── */

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 9,
        fontFamily: "var(--font-body, 'Sintony', sans-serif)",
        color: GLASS_DIM,
        lineHeight: 1.4,
      }}
    >
      <span style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </span>
      <span style={{ color: GLASS_LABEL }}>{value}</span>
    </span>
  );
}
