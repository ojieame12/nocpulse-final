"use client";

import { Info } from "lucide-react";

/* ── Demo Data ── */

const MONTHLY_BARS: { height: number; color: string }[] = [
  { height: 21, color: "#16a34a" },
  { height: 13, color: "#ef4444" },
  { height: 25, color: "#16a34a" },
  { height: 43, color: "#16a34a" },
  { height: 54, color: "#16a34a" },
  { height: 41, color: "#ef4444" },
  { height: 50, color: "#16a34a" },
  { height: 63, color: "#16a34a" },
  { height: 66, color: "#16a34a" },
  { height: 79, color: "#16a34a" },
  { height: 60, color: "#ef4444" },
  { height: 73, color: "#166534" },
];

const STATS_ROWS = [
  { label: "Expected Yield", value: "2.4 t/ha" },
  { label: "Price at Harvest", value: "$682/t" },
  { label: "Field Area", value: "64.2 ha" },
];

const PRECIP_TILES = [
  { label: "SEASON TOTAL", value: "187mm", color: "#3b82f6", bg: "#eff6ff", sub: "vs 210mm avg" },
  { label: "YIELD IMPACT", value: "-5%", color: "#f59e0b", bg: "#f0fdf4", sub: "below 5yr trend" },
  { label: "BASIS RISK", value: "-$12", color: "#f59e0b", bg: "#fefce8", sub: "local vs ICE" },
];

/* ── Component ── */

export function MarketTab() {
  return (
    <div className="mt__root">
      {/* ── 1. Field Title Block ── */}
      <div className="mt__title-block">
        <h2 className="mt__field-name">Quarter SE 25 010 17 W4</h2>
        <span className="mt__subtitle">
          SE 25-010-17 W4M &nbsp;&middot;&nbsp; Legal Land Description
        </span>
      </div>

      {/* ── 2. Canola Spot Price Card ── */}
      <div className="mt__card">
        <div className="mt__card-header">
          <span className="mt__section-label">CANOLA SPOT PRICE</span>
          <span className="mt__date-label">March 2025</span>
        </div>

        <div className="mt__price-row">
          <span className="mt__big-price">$682</span>
          <span className="mt__price-unit">/tonne CAD</span>
          <span className="mt__change-badge">&#9650; +$18 (2.7%)</span>
        </div>

        {/* Bar chart */}
        <div className="mt__chart">
          {MONTHLY_BARS.map((bar, i) => (
            <div
              key={i}
              className="mt__bar"
              style={{ height: bar.height, backgroundColor: bar.color }}
            />
          ))}
        </div>

        {/* 52-week range */}
        <div className="mt__price-range">
          <span className="mt__price-lo">52-wk low: $598</span>
          <span className="mt__price-hi">52-wk high: $724</span>
        </div>
      </div>

      {/* ── 3. Revenue Scenario Card ── */}
      <div className="mt__card">
        <span className="mt__section-label">REVENUE SCENARIO</span>

        <div className="mt__revenue-hero">
          <span className="mt__revenue-number">$139,450</span>
          <span className="mt__revenue-sub">estimated gross</span>
        </div>

        <div className="mt__stats-table">
          {STATS_ROWS.map((row, i) => (
            <div key={i} className="mt__stats-row">
              <span className="mt__stats-label">{row.label}</span>
              <span className="mt__stats-value">{row.value}</span>
            </div>
          ))}

          <div className="mt__gross-row">
            <span className="mt__gross-label">Gross Revenue</span>
            <span className="mt__gross-value">$105,014</span>
          </div>
        </div>

        <p className="mt__rev-note">
          Based on 5-year avg yield for this soil type &times; current futures
        </p>
      </div>

      {/* ── 4. Precipitation & Yield Context ── */}
      <div className="mt__card">
        <span className="mt__section-label">PRECIPITATION &amp; YIELD CONTEXT</span>

        <div className="mt__tiles">
          {PRECIP_TILES.map((stat, i) => (
            <div key={i} className="mt__tile" style={{ backgroundColor: stat.bg }}>
              <span className="mt__tile-label">{stat.label}</span>
              <span className="mt__tile-value" style={{ color: stat.color }}>
                {stat.value}
              </span>
              <span className="mt__tile-sub">{stat.sub}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 5. Info Banner ── */}
      <div className="mt__info-banner">
        <Info size={14} className="mt__info-icon" />
        <p className="mt__info-text">
          Market data is delayed 15 min. Revenue projections are estimates only — not financial
          advice. Prices from ICE Futures Canada.
        </p>
      </div>

      {/* ── 6. Timestamp ── */}
      <div className="mt__timestamp">
        <span className="mt__timestamp-text">
          Last updated: 2025-03-27 07:45 UTC &middot; ICE Futures + StatsCan
        </span>
      </div>
    </div>
  );
}
