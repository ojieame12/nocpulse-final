"use client";

import React, { useState, useMemo } from "react";
import { useAppTheme } from "../../components/layout/WorkspaceShell";
import type {
  FieldAgronomicSurfaceMetricKey,
  ColorRamp,
} from "@fieldpulse/map";
import {
  resolveColorRamp,
  resolveMetricModeContract,
  formatMetricDisplayValue,
  describeMetricSource,
} from "@fieldpulse/map";

/* ═══════════════════════════════════════════════════════════
   FieldPulse V3 — Metric Legend Card (unified)
   ═══════════════════════════════════════════════════════════
   Single top-left map overlay that combines the metric switcher
   pills with the legend info card.

   ┌──────────────────────────────────────────┐
   │  [Moisture] [NDVI] [NDRE] [NDMI]        │  ← switcher pills
   ├──────────────────────────────────────────┤
   │  MOISTURE · Weather-derived model   23% ▾│  ← header (tap to expand)
   │  ┃████████████████████████████████████┃  │  ← gradient bar
   │  Drier                          Wetter   │  ← semantic labels
   ├──────────────────────────────────────────┤
   │  Source: fresh-sar · Confidence: high    │  ← expanded section
   └──────────────────────────────────────────┘

   Glass surface uses shared CSS custom properties.
   ═══════════════════════════════════════════════════════════ */

/* ── Glass tokens (match V1's MapLayerHud) ── */

type GlassTokens = {
  bg: string; border: string; blur: string; shadow: string;
  text: string; muted: string; label: string; dim: string;
  pillBg: string; pillActiveColor: string;
};

const GLASS_DARK: GlassTokens = {
  bg: "var(--glass-bg, rgba(12,18,14,0.84))",
  border: "var(--glass-border, rgba(255,255,255,0.10))",
  blur: "var(--glass-blur, blur(14px))",
  shadow: "0 12px 32px rgba(0,0,0,0.22), 0 4px 12px rgba(0,0,0,0.10)",
  text: "#F8FAFC",
  muted: "rgba(216,239,226,0.72)",
  label: "rgba(241,245,249,0.78)",
  dim: "rgba(226,232,240,0.6)",
  pillBg: "rgba(255,255,255,0.06)",
  pillActiveColor: "#fff",
};

const GLASS_LIGHT: GlassTokens = {
  bg: "rgba(255,255,255,0.82)",
  border: "rgba(0,0,0,0.08)",
  blur: "blur(14px)",
  shadow: "0 12px 32px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)",
  text: "#0c120e",
  muted: "rgba(0,0,0,0.50)",
  label: "rgba(0,0,0,0.65)",
  dim: "rgba(0,0,0,0.40)",
  pillBg: "rgba(0,0,0,0.04)",
  pillActiveColor: "#fff",
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
  /** Requested metric selection for the switcher pills. Defaults to the rendered metric. */
  selectedMetricKey?: FieldAgronomicSurfaceMetricKey;
  metricAveragePct: number | null;
  hoveredMetricPct?: number | null;
  confidence?: "low" | "medium" | "high";
  sourceLabel?: string;
  /** Cross-fade opacity driven by parent (0→1) */
  fadeOpacity?: number;
  /** Full switcher order, including unavailable modes. */
  allMetrics?: readonly FieldAgronomicSurfaceMetricKey[];
  /** Available metrics for the switcher pills */
  availableMetrics?: readonly FieldAgronomicSurfaceMetricKey[];
  availableMetricDetails?: Partial<
    Record<
      FieldAgronomicSurfaceMetricKey,
      {
        sourceLabel?: string;
        confidence?: "low" | "medium" | "high";
      }
    >
  >;
  /** Callback when the user picks a different metric */
  onMetricChange?: (metric: FieldAgronomicSurfaceMetricKey) => void;
};

/* ── Component ── */

export function MetricLegendCard({
  metricKey,
  selectedMetricKey,
  metricAveragePct,
  hoveredMetricPct = null,
  confidence,
  sourceLabel,
  fadeOpacity = 1,
  allMetrics,
  availableMetrics,
  availableMetricDetails,
  onMetricChange,
}: MetricLegendCardProps) {
  const [expanded, setExpanded] = useState(false);
  const theme = useAppTheme();
  const g = theme === "light" ? GLASS_LIGHT : GLASS_DARK;

  const meta = resolveMetricModeContract(metricKey, sourceLabel);
  const ramp = resolveColorRamp(metricKey);
  const gradient = useMemo(() => rampToGradient(ramp), [ramp]);
  const legendValue = hoveredMetricPct ?? metricAveragePct;
  const legendValueLabel = formatMetricDisplayValue(metricKey, legendValue);
  const avgValueLabel = formatMetricDisplayValue(metricKey, metricAveragePct);
  const hoverValueLabel = formatMetricDisplayValue(metricKey, hoveredMetricPct);
  const sourceDescription = describeMetricSource(sourceLabel, confidence);
  const validityDescription = resolveMetricValidity(sourceLabel);

  const avgMarkerLeft = markerOffset(metricAveragePct);
  const hoverMarkerLeft = markerOffset(hoveredMetricPct);

  const activeSwitcherMetricKey = selectedMetricKey ?? metricKey;
  const switcherMetrics =
    allMetrics && allMetrics.length > 0
      ? allMetrics
      : availableMetrics && availableMetrics.length > 0
        ? availableMetrics
        : [metricKey];
  const availableMetricSet = new Set(availableMetrics ?? switcherMetrics);
  const unavailableMetrics = switcherMetrics.filter(
    (metric) => !availableMetricSet.has(metric),
  );
  const showSwitcher = switcherMetrics.length > 1;

  return (
    <div
      className="metric-legend-card"
      style={{
        position: "absolute",
        top: 12,
        left: 12,
        zIndex: 15,
        width: 400,
        borderRadius: 14,
        border: `1px solid ${g.border}`,
        background: g.bg,
        backdropFilter: g.blur,
        WebkitBackdropFilter: g.blur,
        boxShadow: g.shadow,
        overflow: "hidden",
        opacity: fadeOpacity,
        transition: "opacity 300ms cubic-bezier(0.22,1,0.36,1)",
        willChange: "opacity",
        animation: "legendCardEnter 350ms var(--ease-out-soft, cubic-bezier(0.22,1,0.36,1)) both",
      }}
    >
      {/* ── Metric switcher pills (integrated) ── */}
      {showSwitcher ? (
        <div
          style={{
            display: "flex",
            gap: 2,
            padding: "8px 10px 4px",
          }}
        >
          {switcherMetrics.map((metric) => {
            const isActive = metric === activeSwitcherMetricKey;
            const isAvailable = availableMetricSet.has(metric);
            const availabilityBadge = isAvailable
              ? resolveMetricAvailabilityBadge(
                  availableMetricDetails?.[metric]?.sourceLabel,
                )
              : { short: "N/A", long: resolveUnavailableMetricReason(metric) };
            return (
              <button
                key={metric}
                type="button"
                onClick={() => {
                  if (!isAvailable) {
                    return;
                  }
                  onMetricChange?.(metric);
                }}
                disabled={!isAvailable}
                aria-pressed={isActive}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "5px 6px",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 10,
                  fontWeight: isActive ? 600 : 500,
                  fontFamily: "var(--font-body, 'Sintony', sans-serif)",
                  letterSpacing: "0.02em",
                  cursor: isAvailable ? "pointer" : "not-allowed",
                  transition: "all 180ms ease-out",
                  color: isActive ? g.pillActiveColor : isAvailable ? g.dim : g.muted,
                  background: isActive
                    ? "var(--primary-green, #16a34a)"
                    : isAvailable
                      ? g.pillBg
                      : "rgba(255,255,255,0.03)",
                  boxShadow: isActive
                    ? "0 2px 8px rgba(22, 163, 74, 0.35)"
                    : "none",
                  opacity: isAvailable ? 1 : 0.58,
                }}
                title={isAvailable ? availabilityBadge.long : availabilityBadge.long}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    lineHeight: 1,
                  }}
                >
                  <span>
                    {resolveMetricModeContract(
                      metric,
                      availableMetricDetails?.[metric]?.sourceLabel,
                    ).shortLabel}
                  </span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "2px 5px",
                      borderRadius: 999,
                      fontSize: 8,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      background: isActive
                        ? "rgba(255,255,255,0.16)"
                        : isAvailable
                          ? "rgba(255,255,255,0.08)"
                          : "rgba(255,255,255,0.04)",
                      color: isActive ? "rgba(255,255,255,0.96)" : isAvailable ? g.label : g.muted,
                    }}
                  >
                    {availabilityBadge.short}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

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
              color: g.muted,
              fontWeight: 700,
              fontFamily: "var(--font-body, 'Sintony', sans-serif)",
            }}
          >
            {meta.label} · {meta.subtitle}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <span
            style={{
              fontSize: 18,
              fontFamily: "var(--font-heading, Georgia, serif)",
              color: g.text,
              fontWeight: 400,
              transition: "color 180ms ease-out",
            }}
          >
            {legendValueLabel}
          </span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke={g.muted}
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
      <div style={{ padding: "0 14px 10px", marginTop: 24 }}>
        <div
          style={{
            position: "relative",
            height: 8,
            borderRadius: 999,
            background: gradient,
            boxShadow: theme === "dark" ? "inset 0 0 0 1px rgba(255,255,255,0.10)" : "inset 0 0 0 1px rgba(0,0,0,0.08)",
          }}
        >
          {avgMarkerLeft !== null ? (
            <LegendMarker
              leftPct={avgMarkerLeft}
              tone="field"
              label="Field avg"
              value={avgValueLabel}
              isDark={theme === "dark"}
            />
          ) : null}
          {hoverMarkerLeft !== null ? (
            <LegendMarker
              leftPct={hoverMarkerLeft}
              tone="hover"
              label="Cell"
              value={hoverValueLabel}
              isDark={theme === "dark"}
            />
          ) : null}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            marginTop: 4,
          }}
        >
          <span style={{ fontSize: 9, color: g.label, fontWeight: 700 }}>
            {meta.rampStartLabel}
          </span>
          <span style={{ fontSize: 9, color: g.label, fontWeight: 700 }}>
            {meta.rampEndLabel}
          </span>
        </div>
      </div>

      {/* ── Expandable detail section ── */}
      <div
          style={{
            maxHeight: expanded ? 220 : 0,
            opacity: expanded ? 1 : 0,
            overflow: "hidden",
            transition:
            "max-height 350ms cubic-bezier(0.22,1,0.36,1), opacity 250ms cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        <div
          style={{
            borderTop: `1px solid ${g.border}`,
            padding: "10px 14px",
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ display: "grid", gap: 6 }}>
            <MetaRow label="Meaning" value={meta.valueMeaning} glass={g} />
            <MetaRow label="Height" value={meta.heightMeaning} glass={g} />
            {validityDescription ? (
              <MetaRow label="Validity" value={validityDescription} glass={g} />
            ) : null}
            <MetaRow label="Source" value={sourceDescription} glass={g} />
          </div>
          {availableMetrics && availableMetrics.length > 0 ? (
            <div style={{ display: "grid", gap: 6 }}>
              <span
                style={{
                  fontSize: 9,
                  color: g.dim,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Available Modes
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 8px" }}>
                {availableMetrics.map((metric) => {
                  const badge = resolveMetricAvailabilityBadge(
                    availableMetricDetails?.[metric]?.sourceLabel,
                  );
                  const detail = availableMetricDetails?.[metric];
                  const label = resolveMetricModeContract(metric).shortLabel;
                  return (
                    <MetaChip
                      key={`available:${metric}`}
                      label={label}
                      value={`${badge.long}${detail?.confidence ? ` · ${detail.confidence}` : ""}`}
                      glass={g}
                    />
                  );
                })}
              </div>
            </div>
          ) : null}
          {unavailableMetrics.length > 0 ? (
            <div style={{ display: "grid", gap: 6 }}>
              <span
                style={{
                  fontSize: 9,
                  color: g.dim,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Unavailable Modes
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 8px" }}>
                {unavailableMetrics.map((metric) => (
                  <MetaChip
                    key={`unavailable:${metric}`}
                    label={resolveMetricModeContract(metric).shortLabel}
                    value={resolveUnavailableMetricReason(metric)}
                    glass={g}
                  />
                ))}
              </div>
            </div>
          ) : null}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px" }}>
            {meta.thresholds.map((threshold) => (
              <MetaChip
                key={`${metricKey}:${threshold.pct}`}
                label={`${threshold.pct}%`}
                value={threshold.label}
                glass={g}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function resolveMetricAvailabilityBadge(sourceLabel?: string): {
  short: string;
  long: string;
} {
  const normalized = sourceLabel?.trim().toLowerCase() ?? "";

  if (!normalized) {
    return { short: "UNK", long: "Unknown source" };
  }

  if (normalized.includes("synthetic")) {
    return { short: "SYN", long: "Synthetic fallback" };
  }

  if (normalized.includes("preseason-optical-context")) {
    return { short: "CTX", long: "Preseason optical context" };
  }

  if (normalized.includes("sentinel-1") || normalized.includes("sar")) {
    return { short: "SAR", long: "SAR-backed" };
  }

  if (
    normalized.includes("sentinel-2") ||
    normalized.includes("planet") ||
    normalized.includes("optical")
  ) {
    return { short: "OPT", long: "Optical" };
  }

  if (normalized.includes("model") || normalized.includes("twi")) {
    return { short: "EST", long: "Modeled" };
  }

  return { short: "LIVE", long: "Live source" };
}

function resolveMetricValidity(sourceLabel?: string): string | null {
  const normalized = sourceLabel?.trim().toLowerCase() ?? "";

  if (!normalized) {
    return null;
  }

  if (normalized.includes("preseason-optical-context")) {
    return "Preseason optical context";
  }

  if (
    normalized.includes("sentinel-2") ||
    normalized.includes("planet") ||
    normalized.includes("optical")
  ) {
    return "Seasonally interpretable";
  }

  if (normalized.includes("sentinel-1") || normalized.includes("sar")) {
    return "SAR-backed surface";
  }

  if (normalized.includes("synthetic")) {
    return "Synthetic fallback";
  }

  return null;
}

function resolveUnavailableMetricReason(
  metricKey: FieldAgronomicSurfaceMetricKey,
): string {
  switch (metricKey) {
    case "ndre":
      return "Waiting for a cloud-free red-edge satellite pass. Sentinel-2 revisits every 5 days.";
    case "ndvi":
      return "Waiting for a cloud-free optical pass. NDVI will appear once Sentinel-2 imagery is processed for this field.";
    case "ndmi":
      return "Waiting for a cloud-free optical pass. Leaf moisture index requires the same Sentinel-2 imagery as NDVI.";
    case "radar-wetness":
      return "No SAR wetness surface available yet. Sentinel-1 radar data is weather-independent but may take a few days to process.";
    case "surface-moisture-pct":
      return "Surface moisture layer is not yet available for this field.";
    case "root-zone-moisture-pct":
    default:
      return "Moisture surface is not yet available for this field.";
  }
}

/* ── Tiny meta chip ── */

function MetaChip({ label, value, glass }: { label: string; value: string; glass: GlassTokens }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 9,
        fontFamily: "var(--font-body, 'Sintony', sans-serif)",
        color: glass.dim,
        lineHeight: 1.4,
      }}
    >
      <span style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </span>
      <span style={{ color: glass.label }}>{value}</span>
    </span>
  );
}

function MetaRow({ label, value, glass }: { label: string; value: string; glass: GlassTokens }) {
  return (
    <div style={{ display: "grid", gap: 2 }}>
      <span
        style={{
          fontSize: 9,
          color: glass.dim,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 11, color: glass.label, lineHeight: 1.4 }}>{value}</span>
    </div>
  );
}

function markerOffset(value: number | null | undefined): number | null {
  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.min(100, Math.max(0, value!));
}

function LegendMarker({
  leftPct,
  tone,
  label,
  value,
  isDark = true,
}: {
  leftPct: number;
  tone: "field" | "hover";
  label: string;
  value: string;
  isDark?: boolean;
}) {
  const color = isDark
    ? (tone === "hover" ? "rgba(255,255,255,0.98)" : "rgba(216,239,226,0.84)")
    : (tone === "hover" ? "rgba(0,0,0,0.90)" : "rgba(0,60,30,0.70)");

  return (
    <div
      style={{
        position: "absolute",
        left: `${leftPct}%`,
        top: "50%",
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          width: 2,
          height: 14,
          borderRadius: 999,
          background: color,
          boxShadow: "0 0 0 1px rgba(12,18,14,0.28)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: -30,
          left: "50%",
          transform: "translateX(-50%)",
          padding: "3px 6px",
          borderRadius: 999,
          border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.08)",
          background: isDark ? "rgba(8, 12, 10, 0.82)" : "rgba(255,255,255,0.92)",
          color: color,
          fontSize: 9,
          fontWeight: 600,
          whiteSpace: "nowrap",
          boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
        }}
      >
        {label} {value}
      </div>
    </div>
  );
}
