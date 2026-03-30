'use client';

import { PanelHeader } from '../../../components/ui/PanelHeader';
import { Badge } from '../../../components/ui/Badge';
import { DonutChart } from '../../../components/ui/DonutChart';
import { AlertTriangle } from 'lucide-react';

/* ── Types ── */

type CellHealth = 'healthy' | 'stressed' | 'critical';

interface CellRow {
  id: string;
  health: CellHealth;
}

interface ZoneAlert {
  id: string;
  message: string;
  timestamp: string;
}

/* ── Static data ── */

const CELLS: CellRow[] = [
  { id: 'R12-C03', health: 'healthy' },
  { id: 'R12-C04', health: 'healthy' },
  { id: 'R12-C05', health: 'healthy' },
  { id: 'R12-C03', health: 'healthy' },
];

const ZONE_ALERTS: ZoneAlert[] = [
  {
    id: '1',
    message: 'Cell R11-C05 showing stress indicators — schedule scout',
    timestamp: 'Oct 12, 2025 · 14:32 UTC',
  },
];

const HEALTH_LABEL: Record<CellHealth, string> = {
  healthy: 'Healthy',
  stressed: 'Stressed',
  critical: 'Critical',
};

const HEALTH_BADGE_VARIANT: Record<CellHealth, 'positive' | 'warning' | 'danger'> = {
  healthy: 'positive',
  stressed: 'warning',
  critical: 'danger',
};

/* ── Component ── */

interface ZoneDetailPanelProps {
  onClose?: () => void;
  onMaximize?: () => void;
}

export default function ZoneDetailPanel({ onClose, onMaximize }: ZoneDetailPanelProps) {
  return (
    <div className="zone-detail">
      <PanelHeader title="ZONE DETAIL" onClose={onClose} onMaximize={onMaximize} />

      <div className="panel__body">
        {/* 1. Title + health badge */}
        <div className="zone-detail__title-row">
          <div className="panel__title-section">
            <span className="panel__title-main">Zone NW-3</span>
            <span className="panel__title-sub">Northwest quadrant · 12 cells</span>
          </div>
          <Badge variant="positive" dot>HEALTHY</Badge>
        </div>

        {/* 2. Zone Health — donut + stats */}
        <div className="zone-detail__section">
          <span className="panel__section-label">ZONE HEALTH</span>
          <div className="zone-detail__health-card">
            <DonutChart value={0.68} label="0.68" caption="AVG NDVI" size={120} />
            <div className="zone-detail__health-stats">
              <div className="zone-detail__health-stat">
                <span className="zone-detail__health-stat-label">Field Portion</span>
                <span className="zone-detail__health-stat-value zone-detail__health-stat-value--green">Healthy</span>
              </div>
              <div className="zone-detail__health-stat">
                <span className="zone-detail__health-stat-label">Last captured</span>
                <span className="zone-detail__health-stat-value">10/12</span>
              </div>
              <div className="zone-detail__health-stat">
                <span className="zone-detail__health-stat-label">Trend</span>
                <span className="zone-detail__health-stat-value zone-detail__health-stat-value--green">+0.03</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Zone Metrics — 2x2 grid */}
        <div className="zone-detail__section">
          <span className="panel__section-label">ZONE METRICS</span>
          <div className="panel__data-grid">
            <div className="panel__data-row">
              <div className="panel__data-cell">
                <span className="panel__data-cell-label">AREA</span>
                <span className="panel__data-cell-value">18.4 ha</span>
              </div>
              <div className="panel__data-cell">
                <span className="panel__data-cell-label">AVG NDVI</span>
                <span className="panel__data-cell-value">0.68</span>
              </div>
            </div>
            <div className="panel__data-row">
              <div className="panel__data-cell">
                <span className="panel__data-cell-label">AVG MOISTURE</span>
                <span className="panel__data-cell-value">
                  <span className="zone-detail__pill zone-detail__pill--green">58%</span>
                </span>
              </div>
              <div className="panel__data-cell">
                <span className="panel__data-cell-label">CELLS IN BAND</span>
                <span className="panel__data-cell-value">12</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Cell Breakdown */}
        <div className="zone-detail__section">
          <span className="panel__section-label">CELL BREAKDOWN</span>
          <div className="zone-detail__cell-list">
            {CELLS.map((cell, i) => (
              <div key={`${cell.id}-${i}`} className="zone-detail__cell-row">
                <span className="zone-detail__cell-id">{cell.id}</span>
                <span className={`zone-detail__cell-badge zone-detail__cell-badge--${cell.health}`}>
                  {HEALTH_LABEL[cell.health]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 5. Active Zone Alerts */}
        <div className="zone-detail__section">
          <span className="panel__section-label">ACTIVE ZONE ALERTS</span>
          <div className="zone-detail__alerts">
            {ZONE_ALERTS.map((alert) => (
              <div key={alert.id} className="zone-detail__alert-card">
                <div className="zone-detail__alert-icon">
                  <AlertTriangle size={14} />
                </div>
                <div className="zone-detail__alert-body">
                  <span className="zone-detail__alert-msg">{alert.message}</span>
                  <span className="zone-detail__alert-time">{alert.timestamp}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
