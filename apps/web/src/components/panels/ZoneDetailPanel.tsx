'use client';

import { AlertTriangle, Layers, TrendingUp, Droplets, Grid3X3 } from 'lucide-react';
import { DonutChart, PanelHeader } from '../ui';

interface ZoneDetailPanelProps {
  onClose?: () => void;
}

/* ── Demo data ── */

const cells = [
  { id: 'R12-C03', status: 'healthy' as const },
  { id: 'R12-C04', status: 'healthy' as const },
  { id: 'R12-C05', status: 'stressed' as const },
  { id: 'R13-C03', status: 'healthy' as const },
];

export function ZoneDetailPanel({ onClose }: ZoneDetailPanelProps) {
  return (
    <div className="panel">
      <PanelHeader title="ZONE DETAIL" onBack={onClose} onClose={onClose} />
      <div className="panel__body" style={{ padding: '32px 32px 16px 32px' }}>
        {/* ── Zone Identity ── */}
        <div className="zone-identity">
          <span className="zone-identity__name">Zone NW-3</span>
          <span className="zone-identity__sub">
            Northwest quadrant &middot; 12 cells
          </span>
          <span className="zone-identity__badge">HEALTHY</span>
        </div>

        {/* ── Zone Health ── */}
        <div className="styled-section">
          <span className="styled-section__header">ZONE HEALTH</span>
          <div className="donut-container">
            <DonutChart value={0.68} label="0.68" size={120} color="#16a34a" />
            <div className="donut-info">
              <div className="donut-info__row">
                <Layers size={14} className="donut-info__icon" />
                <div className="donut-info__text">
                  <span className="donut-info__label">Classification</span>
                  <span className="donut-info__value" style={{ color: 'var(--status-positive)' }}>Healthy</span>
                </div>
              </div>
              <div className="donut-info__row">
                <Grid3X3 size={14} className="donut-info__icon" />
                <div className="donut-info__text">
                  <span className="donut-info__label">Cells Healthy</span>
                  <span className="donut-info__value">10/12</span>
                </div>
              </div>
              <div className="donut-info__row">
                <TrendingUp size={14} className="donut-info__icon" />
                <div className="donut-info__text">
                  <span className="donut-info__label">Trend</span>
                  <span className="donut-info__value" style={{ color: 'var(--status-positive)' }}>+0.03</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Zone Metrics ── */}
        <div className="styled-section">
          <span className="styled-section__header">ZONE METRICS</span>
          <div className="zone-metrics-row">
            <div className="zone-metric-tile zone-metric-tile--neutral">
              <span className="zone-metric-tile__value" style={{ color: '#1f2937' }}>18.4 ha</span>
              <span className="zone-metric-tile__label">
                <Layers size={10} /> AREA
              </span>
            </div>
            <div className="zone-metric-tile zone-metric-tile--green">
              <span className="zone-metric-tile__value" style={{ color: 'var(--status-positive)' }}>0.68</span>
              <span className="zone-metric-tile__label">
                <TrendingUp size={10} /> AVG NDVI
              </span>
            </div>
          </div>
          <div className="zone-metrics-row">
            <div className="zone-metric-tile zone-metric-tile--blue">
              <span className="zone-metric-tile__value" style={{ color: '#3b82f6' }}>58%</span>
              <span className="zone-metric-tile__label">
                <Droplets size={10} /> VEG MOISTURE
              </span>
            </div>
            <div className="zone-metric-tile zone-metric-tile--neutral">
              <span className="zone-metric-tile__value" style={{ color: '#1f2937' }}>12</span>
              <span className="zone-metric-tile__label">
                <Grid3X3 size={10} /> CELLS ANALYZED
              </span>
            </div>
          </div>
        </div>

        {/* ── Cell Breakdown ── */}
        <div className="styled-section">
          <span className="styled-section__header">CELL BREAKDOWN</span>
          {cells.map((cell) => (
            <div key={cell.id} className="cell-row">
              <span className="cell-row__id">{cell.id}</span>
              <span className={`cell-row__badge cell-row__badge--${cell.status}`}>
                {cell.status.charAt(0).toUpperCase() + cell.status.slice(1)}
              </span>
            </div>
          ))}
        </div>

        {/* ── Active Zone Alerts ── */}
        <div className="styled-section">
          <span className="styled-section__header">ACTIVE ZONE ALERTS</span>
          <div className="zone-alert-card">
            <AlertTriangle size={16} style={{ color: 'var(--status-warning)', flexShrink: 0 }} />
            <span className="zone-alert-card__text">
              Cell R12-C05 showing stress indicators &mdash; schedule scout
            </span>
          </div>
        </div>

        {/* ── Timestamp ── */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize: '8px',
            color: 'var(--text-tertiary)',
          }}>
            Last updated: 2025-03-27 08:14 UTC
          </span>
        </div>
      </div>
    </div>
  );
}
