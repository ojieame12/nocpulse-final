'use client';

import { BellOff } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { MetricTile } from '../ui/MetricTile';
import { PanelHeader } from '../ui/PanelHeader';
import { PanelEmptyState } from '../ui/PanelEmptyState';

/* ── Types ── */

export interface AlertItem {
  id: string;
  title: string;
  severity: 'critical' | 'warning' | 'low' | 'medium';
  subtitle: string;
  time: string;
  trackedZoneIds: readonly string[];
}

export interface ResolvedAlertItem {
  id: string;
  title: string;
  subtitle: string;
  time: string;
  trackedZoneIds: readonly string[];
}

export interface AlertsPanelProps {
  activeAlerts: AlertItem[];
  resolvedAlerts: ResolvedAlertItem[];
  activeCount: number;
  criticalCount: number;
  weekCount: number;
  focusedZoneId?: string | null;
  onAlertSelect?: (zoneId: string | null) => void;
  onClose?: () => void;
}

const severityBadge: Record<string, 'danger' | 'warning' | 'positive'> = {
  critical: 'danger',
  high: 'danger',
  warning: 'warning',
  medium: 'warning',
  low: 'warning',
  resolved: 'positive',
};

export function AlertsPanel({
  activeAlerts,
  resolvedAlerts,
  activeCount,
  criticalCount,
  weekCount,
  focusedZoneId,
  onAlertSelect,
  onClose,
}: AlertsPanelProps) {
  return (
    <div className="panel">
      <PanelHeader title="ALERTS" onClose={onClose} />
      <div className="panel__body">
        <div className="metric-tiles">
          <MetricTile value={String(activeCount)} label="Active" />
          <MetricTile value={String(criticalCount)} label="Critical" valueColor="#dc2626" />
          <MetricTile value={String(weekCount)} label="This Week" />
        </div>

        <div className="filter-pills">
          <button className="filter-pill filter-pill--active">All</button>
          <button className="filter-pill">Critical</button>
          <button className="filter-pill">Warning</button>
          <button className="filter-pill">Info</button>
        </div>

        {activeAlerts.length > 0 && (
          <div className="alerts-section">
            <span className="styled-section__header">ACTIVE ALERTS</span>

            {activeAlerts.map((alert) => (
              <button
                key={alert.id}
                type="button"
                className={`alerts-card alerts-card--${alert.severity} alerts-card--interactive${
                  focusedZoneId && alert.trackedZoneIds.includes(focusedZoneId)
                    ? ' alerts-card--focused'
                    : ''
                }`}
                onClick={() =>
                  onAlertSelect?.(
                    focusedZoneId && alert.trackedZoneIds.includes(focusedZoneId)
                      ? null
                      : alert.trackedZoneIds[0] ?? null,
                  )
                }
              >
                <div className="alerts-card__top">
                  <span className="alerts-card__title">{alert.title}</span>
                  <Badge variant={severityBadge[alert.severity] ?? 'warning'}>
                    {alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1)}
                  </Badge>
                </div>
                <span className="alerts-card__subtitle">{alert.subtitle}</span>
                <span className="alerts-card__time">{alert.time}</span>
              </button>
            ))}
          </div>
        )}

        {resolvedAlerts.length > 0 && (
          <div className="alerts-section">
            <span className="styled-section__header">RESOLVED TODAY</span>

            {resolvedAlerts.map((alert) => (
              <button
                key={alert.id}
                type="button"
                className={`alerts-card alerts-card--resolved alerts-card--interactive${
                  focusedZoneId && alert.trackedZoneIds.includes(focusedZoneId)
                    ? ' alerts-card--focused'
                    : ''
                }`}
                onClick={() =>
                  onAlertSelect?.(
                    focusedZoneId && alert.trackedZoneIds.includes(focusedZoneId)
                      ? null
                      : alert.trackedZoneIds[0] ?? null,
                  )
                }
              >
                <div className="alerts-card__top">
                  <span className="alerts-card__title">{alert.title}</span>
                  <Badge variant="positive">Resolved</Badge>
                </div>
                <span className="alerts-card__subtitle">{alert.subtitle}</span>
                <span className="alerts-card__time">{alert.time}</span>
              </button>
            ))}
          </div>
        )}

        {activeAlerts.length === 0 && resolvedAlerts.length === 0 && (
          <PanelEmptyState
            icon={BellOff}
            title="All clear"
            description="No active alerts for your fields. We'll notify you when something needs attention."
          />
        )}
      </div>
    </div>
  );
}
