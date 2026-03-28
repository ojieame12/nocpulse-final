'use client';

import { Info } from 'lucide-react';

const BAR_DATA = [
  { height: 21, color: '#16a34a' },
  { height: 13, color: '#ef4444' },
  { height: 25, color: '#16a34a' },
  { height: 43, color: '#16a34a' },
  { height: 54, color: '#16a34a' },
  { height: 41, color: '#ef4444' },
  { height: 50, color: '#16a34a' },
  { height: 63, color: '#16a34a' },
  { height: 66, color: '#16a34a' },
  { height: 79, color: '#16a34a' },
  { height: 60, color: '#ef4444' },
  { height: 73, color: '#166534' },
];

const REVENUE_ROWS = [
  { label: 'Expected Yield', value: '2.4 t/ha' },
  { label: 'Price at Harvest', value: '$682/t' },
  { label: 'Field Area', value: '64.2 ha' },
];

const PRECIP_TILES = [
  { label: 'SEASON TOTAL', value: '187mm', valueColor: '#3b82f6', sub: 'vs 210mm avg', bg: '#eff6ff' },
  { label: 'YIELD IMPACT', value: '-5%', valueColor: '#f59e0b', sub: 'below 5yr trend', bg: '#f0fdf4' },
  { label: 'BASIS RISK', value: '-$12', valueColor: '#f59e0b', sub: 'local vs ICE', bg: '#fefce8' },
];

export function MarketTab() {
  return (
    <div className="panel__body" style={{ paddingBottom: 16 }}>
      {/* Title Section */}
      <div className="panel__title-section">
        <h2 className="panel__title-main">Quarter SE 25 010 17 W4</h2>
        <span className="panel__title-sub">SE 25-010-17 W4M  &middot;  Legal Land Description</span>
      </div>

      {/* ── Price Hero Section ── */}
      <div className="market__section-card">
        <div className="market__section-row">
          <span className="panel__section-label">CANOLA SPOT PRICE</span>
          <span className="market__section-meta">March 2025</span>
        </div>

        <div className="market__price-row">
          <span className="market__price-value">$682</span>
          <span className="market__price-unit">/tonne CAD</span>
          <span className="market__price-delta">&#9650; +$18 (2.7%)</span>
        </div>

        {/* Bar chart */}
        <div className="market__bar-chart">
          {BAR_DATA.map((bar, i) => (
            <div
              key={i}
              className="market__bar"
              style={{ height: bar.height, background: bar.color }}
            />
          ))}
        </div>

        <div className="market__price-range">
          <span className="market__price-lo">52-wk low: $598</span>
          <span className="market__price-hi">52-wk high: $724</span>
        </div>
      </div>

      {/* ── Revenue Scenario Section ── */}
      <div className="market__section-card">
        <span className="panel__section-label">REVENUE SCENARIO</span>

        <div className="market__revenue-hero">
          <span className="market__revenue-value">$139,450</span>
          <span className="market__revenue-label">estimated gross</span>
        </div>

        <div className="market__revenue-grid">
          {REVENUE_ROWS.map((row) => (
            <div key={row.label} className="market__revenue-row">
              <span className="market__revenue-row-label">{row.label}</span>
              <span className="market__revenue-row-value">{row.value}</span>
            </div>
          ))}
          <div className="market__revenue-row market__revenue-row--total">
            <span className="market__revenue-row-label market__revenue-row-label--bold">Gross Revenue</span>
            <span className="market__revenue-row-value market__revenue-row-value--green">$105,014</span>
          </div>
        </div>

        <span className="market__revenue-note">
          Based on 5-year avg yield for this soil type &times; current futures
        </span>
      </div>

      {/* ── Precipitation & Yield Context ── */}
      <div className="market__section-card">
        <span className="panel__section-label">PRECIPITATION &amp; YIELD CONTEXT</span>

        <div className="market__precip-tiles">
          {PRECIP_TILES.map((tile) => (
            <div
              key={tile.label}
              className="market__precip-tile"
              style={{ background: tile.bg }}
            >
              <span className="market__precip-tile-label">{tile.label}</span>
              <span className="market__precip-tile-value" style={{ color: tile.valueColor }}>{tile.value}</span>
              <span className="market__precip-tile-sub">{tile.sub}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Disclaimer ── */}
      <div className="market__disclaimer">
        <Info size={14} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
        <span className="market__disclaimer-text">
          Market data is delayed 15 min. Revenue projections are estimates only — not financial advice. Prices from ICE Futures Canada.
        </span>
      </div>

      {/* ── Footer Timestamp ── */}
      <div className="market__footer">
        <span className="market__footer-text">
          Last updated: 2025-03-27 07:45 UTC &middot; ICE Futures + StatsCan
        </span>
      </div>
    </div>
  );
}
