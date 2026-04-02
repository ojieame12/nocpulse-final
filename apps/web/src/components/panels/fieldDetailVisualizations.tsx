/**
 * SVG visualization primitives for FieldDetailPanel.
 *
 * Extracted from FieldDetailPanel.tsx — no behavior change.
 * Spark, LineSpark, MiniDonut, HeroDonut, ProgBar.
 */

import React, { useEffect, useState } from "react";

export function Spark({ data, color, height = 32 }: { data: number[]; color: string; height?: number }) {
  if (data.length === 0) return <div style={{ height }} />;
  const normalizedData = data.map((value) => (Number.isFinite(value) ? value : 0));
  const max = Math.max(...normalizedData);
  const min = Math.min(...normalizedData);
  const range = max - min;
  const count = normalizedData.length;
  const amplitude = height * 0.9;
  /* Ensure minimum 5 slots so ≤4 bars don't stretch into blobs */
  const slots = Math.max(count, 5);
  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${slots * 10} ${height}`}
      preserveAspectRatio="none"
      style={{ display: "block" }}
    >
      {normalizedData.map((value, i) => {
        const normalized =
          range > 0 ? (value - min) / range : Math.abs(value) > Number.EPSILON ? 0.55 : 0;
        const h = Math.max(normalized * amplitude, 0);
        return (
          <rect
            key={i}
            x={i * 10 + 1}
            y={height - h}
            width={7}
            height={h}
            rx={3}
            fill={color}
            opacity={0.15 + normalized * 0.65}
          />
        );
      })}
    </svg>
  );
}

export function LineSpark({ data, color, height = 48 }: { data: number[]; color: string; height?: number }) {
  const finiteData = data.filter((value) => Number.isFinite(value));

  if (finiteData.length === 0) return <div style={{ height }} />;

  const max = Math.max(...finiteData);
  const min = Math.min(...finiteData);
  const range = max - min || 1;
  const denominator = Math.max(finiteData.length - 1, 1);
  const pts = finiteData
    .map((v, i) => {
      const x = finiteData.length === 1 ? 100 : (i / denominator) * 200;
      const y = height - 4 - ((v - min) / range) * (height - 8);
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 200 ${height}`}
      preserveAspectRatio="none"
      style={{ display: "block" }}
    >
      <polygon points={`0,${height} ${pts} 200,${height}`} fill={color} opacity={0.06} />
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.5}
      />
    </svg>
  );
}

export function MultiLineSpark({
  series,
  height = 48,
}: {
  series: { data: number[]; color: string }[];
  height?: number;
}) {
  const normalizedSeries = series
    .map((entry) => ({
      color: entry.color,
      data: entry.data.filter((value) => Number.isFinite(value)),
    }))
    .filter((entry) => entry.data.length > 0);

  if (normalizedSeries.length === 0) return <div style={{ height }} />;

  const allValues = normalizedSeries.flatMap((entry) => entry.data);
  const max = Math.max(...allValues);
  const min = Math.min(...allValues);
  const range = max - min || 1;

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 200 ${height}`}
      preserveAspectRatio="none"
      style={{ display: "block" }}
    >
      {normalizedSeries.map((entry, index) => {
        const denominator = Math.max(entry.data.length - 1, 1);
        const pts = entry.data
          .map((value, pointIndex) => {
            const x = entry.data.length === 1 ? 100 : (pointIndex / denominator) * 200;
            const y = height - 4 - ((value - min) / range) * (height - 8);
            return `${x},${y}`;
          })
          .join(" ");

        return (
          <g key={`${entry.color}-${index}`}>
            {index === 0 && entry.data.length > 1 ? (
              <polygon
                points={`0,${height} ${pts} 200,${height}`}
                fill={entry.color}
                opacity={0.05}
              />
            ) : null}
            <polyline
              points={pts}
              fill="none"
              stroke={entry.color}
              strokeWidth={index === 0 ? 2 : 1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={index === 0 ? 0.55 : 0.38}
            />
          </g>
        );
      })}
    </svg>
  );
}

export function MiniDonut({
  value,
  color,
  size = 40,
  sw = 3,
}: {
  value: number;
  color: string;
  size?: number;
  sw?: number;
}) {
  const r = (size - sw) / 2;
  const ci = 2 * Math.PI * r;
  const off = ci * (1 - Math.min(value, 1));
  return (
    <svg width={size} height={size}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={sw}
        opacity={0.15}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeDasharray={ci}
        strokeDashoffset={off}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

export function HeroDonut({
  value,
  display,
  unit,
  color,
  label,
}: {
  value: number;
  display: string;
  unit: string;
  color: string;
  label: string;
}) {
  const size = 120;
  const sw = 4.5;
  const r = (size - sw) / 2;
  const ci = 2 * Math.PI * r;
  const safeValue = Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : 0;
  const off = ci * (1 - safeValue);
  const [d, setD] = useState(false);

  useEffect(() => {
    setD(false);
    requestAnimationFrame(() => requestAnimationFrame(() => setD(true)));
  }, [value]);

  return (
    <svg width={size} height={size} style={{ display: "block", flexShrink: 0 }}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={sw}
        opacity={0.12}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeDasharray={ci}
        strokeDashoffset={d ? off : ci}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 900ms cubic-bezier(.4,0,.2,1)" }}
      />
      <text
        x={size / 2}
        y={size / 2 - 6}
        textAnchor="middle"
        dominantBaseline="central"
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: 28,
          fontWeight: 400,
          fill: "var(--text-primary)",
        }}
      >
        {display}
        {unit ? (
          <tspan
            style={{
              fontSize: 16,
              fontFamily: "var(--font-body)",
              fill: "var(--text-muted)",
            }}
          >
            {unit}
          </tspan>
        ) : null}
      </text>
      <text
        x={size / 2}
        y={size / 2 + 18}
        textAnchor="middle"
        dominantBaseline="central"
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 8,
          fontWeight: 700,
          fill: "var(--text-muted)",
          letterSpacing: "1.2px",
        }}
      >
        {label}
      </text>
    </svg>
  );
}

export function ProgBar({ value, color, height = 4 }: { value: number; color: string; height?: number }) {
  const safeValue = Number.isFinite(value) ? Math.min(Math.max(value, 0), 100) : 0;
  return (
    <div
      className="fdp-prog"
      style={{ height, background: `${color}18` }}
    >
      <div
        className="fdp-prog__fill"
        style={{ width: `${safeValue}%`, background: color }}
      />
    </div>
  );
}
