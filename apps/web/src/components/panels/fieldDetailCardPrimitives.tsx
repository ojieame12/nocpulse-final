/**
 * Card layout primitives for FieldDetailPanel.
 *
 * Extracted from FieldDetailPanel.tsx — no behavior change.
 * Card, AlertCard, Lbl, LblM, isMetricValue, Big, Sub, Mono.
 */

import React from "react";

export function Card({
  span,
  children,
  accent,
  onClick,
  className: extra,
  style,
  sevTint,
  "data-metric-hint": metricHint,
  "data-metric-value": metricValue,
}: {
  span?: number;
  children: React.ReactNode;
  accent?: string;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
  /** Severity-aware background gradient tint */
  sevTint?: string;
  "data-metric-hint"?: string;
  "data-metric-value"?: string;
}) {
  const spanClass =
    span === 2
      ? "fdp-card--span-2"
      : span === 3
        ? "fdp-card--span-3"
        : span === 4
          ? "fdp-card--span-4"
          : span === -1
            ? "fdp-card--span-full"
            : "";

  return (
    <div
      onClick={onClick}
      className={[
        "fdp-card",
        spanClass,
        accent ? "fdp-card--accent" : "",
        onClick ? "fdp-card--clickable" : "",
        extra || "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        ...(accent ? { borderLeft: `3px solid ${accent}` } : {}),
        ...(sevTint ? { background: sevTint } : {}),
        ...style,
      }}
      data-metric-hint={metricHint}
      data-metric-value={metricValue}
    >
      {children}
    </div>
  );
}

export function AlertCard({
  sev = "danger",
  span,
  children,
}: {
  sev?: "danger" | "warning";
  span?: number;
  children: React.ReactNode;
}) {
  const spanClass =
    span === 2
      ? "fdp-card--span-2"
      : span === 3
        ? "fdp-card--span-3"
        : span === 4
          ? "fdp-card--span-4"
          : span === -1
            ? "fdp-card--span-full"
            : "";

  return (
    <div
      className={["fdp-card", spanClass, sev === "danger" ? "fdp-card--danger" : "fdp-card--warning"]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}

export function Lbl({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span className="fdp-lbl" style={{ color: color || undefined }}>
      {children}
    </span>
  );
}

export function LblM({ children }: { children: React.ReactNode }) {
  return <span className="fdp-lbl fdp-lbl--muted">{children}</span>;
}

/** Detect if a value is numeric/metric (keep big) or text (shrink) */
export function isMetricValue(value: React.ReactNode): boolean {
  if (typeof value !== "string") return true; // non-string = assume metric
  if (value === "—") return true; // dash placeholder stays big
  // Metric patterns: numbers, percentages, decimals, signed numbers, units like "13.0°C", "0.72", "18 km/h"
  return /^[−\-+]?\d/.test(value) || /^\d/.test(value.replace(/^[−\-+]/, ""));
}

/**
 * Split a metric string like "+3.9 mm", "42%", "13.0°C", "$4.20/bu"
 * into { number, unit } so the unit can be rendered smaller.
 * Returns null if value is not a parseable metric string.
 */
function splitValueUnit(value: React.ReactNode): { num: string; unit: string } | null {
  if (typeof value !== "string") return null;
  // Match: optional sign, digits (with optional decimals/commas), then trailing unit
  // "+3.9 mm" → ["+3.9", "mm"], "42%" → ["42", "%"], "13.0°C" → ["13.0", "°C"]
  // "$4.20/bu" → ["$4.20", "/bu"], "0.72" → no unit, "—" → no unit
  const m = value.match(/^([−\u2212+\-]?\$?[\d][\d,]*\.?\d*)\s*([%°/a-zA-Z²³].*)$/);
  if (!m) return null;
  return { num: m[1], unit: m[2] };
}

export function Big({
  children,
  color,
  size = 26,
}: {
  children: React.ReactNode;
  color?: string;
  size?: number;
}) {
  // Auto-downsize text labels, keep numbers at requested size
  const isMetric = isMetricValue(children);
  const effectiveSize = isMetric ? size : Math.min(size, 16);

  const sizeClass =
    effectiveSize <= 14
      ? "fdp-big--14"
      : effectiveSize <= 16
        ? "fdp-big--16"
        : effectiveSize <= 18
          ? "fdp-big--18"
          : effectiveSize <= 20
            ? "fdp-big--20"
            : effectiveSize <= 22
              ? "fdp-big--22"
              : effectiveSize <= 24
                ? "fdp-big--24"
                : effectiveSize <= 26
                  ? "fdp-big--26"
                  : effectiveSize <= 28
                    ? "fdp-big--28"
                    : "fdp-big--32";

  // Split trailing unit from numeric values for reduced-size rendering
  const parts = isMetric ? splitValueUnit(children) : null;

  return (
    <span
      className={`fdp-big ${sizeClass}${!isMetric ? " fdp-big--text" : ""}`}
      style={parts ? undefined : { color: color || undefined }}
    >
      {parts ? (
        <>
          <span style={{ color: color || undefined }}>{parts.num}</span>
          <span className="fdp-big__unit">{parts.unit}</span>
        </>
      ) : (
        children
      )}
    </span>
  );
}

export function Sub({ children }: { children: React.ReactNode }) {
  return <span className="fdp-sub">{children}</span>;
}

export function Mono({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span className="fdp-mono" style={{ color: color || "var(--text-secondary)" }}>
      {children}
    </span>
  );
}
