'use client';

import { useState } from 'react';
import { PanelHeader } from '../../../components/ui/PanelHeader';

/* ── Types ── */

type AlertSeverity = 'critical' | 'warning' | 'info' | 'resolved';

interface Alert {
  id: string;
  title: string;
  subtitle: string;
  time: string;
  severity: AlertSeverity;
}

/* ── Static data ── */

const ACTIVE_ALERTS: Alert[] = [
  {
    id: '1',
    title: 'NDVI Drop Detected',
    subtitle: 'North Quarter A · Zone NW-3',
    time: '3h ago',
    severity: 'critical',
  },
  {
    id: '2',
    title: 'Soil Moisture Below Threshold',
    subtitle: 'East Field B · Zone E-1',
    time: '5h ago',
    severity: 'warning',
  },
  {
    id: '3',
    title: 'Pest Pressure Increasing',
    subtitle: 'South Terrace · Zone ST-2',
    time: '8h ago',
    severity: 'warning',
  },
];

const RESOLVED_ALERTS: Alert[] = [
  {
    id: '4',
    title: 'Irrigation Schedule Complete',
    subtitle: 'North Quarter A · Zone NW-1',
    time: '1h ago',
    severity: 'resolved',
  },
];

const FILTER_TABS = ['All', 'Critical', 'Warning', 'Info'] as const;

type FilterTab = (typeof FILTER_TABS)[number];

/* ── Badge ── */

function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  const label =
    severity === 'critical'
      ? 'Critical'
      : severity === 'warning'
        ? 'Warning'
        : severity === 'resolved'
          ? 'Resolved'
          : 'Info';

  return (
    <span className={`alerts__badge alerts__badge--${severity}`}>{label}</span>
  );
}

/* ── Alert card ── */

function AlertCard({ alert }: { alert: Alert }) {
  return (
    <div className={`alerts__card alerts__card--${alert.severity}`}>
      <div className="alerts__card-top">
        <span className="alerts__card-title">{alert.title}</span>
        <SeverityBadge severity={alert.severity} />
      </div>
      <span className="alerts__card-subtitle">{alert.subtitle}</span>
      <span className="alerts__card-time">{alert.time}</span>
    </div>
  );
}

/* ── Main panel ── */

interface AlertsPanelProps {
  onClose?: () => void;
  onMaximize?: () => void;
}

export default function AlertsPanel({ onClose, onMaximize }: AlertsPanelProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>('All');

  const filteredAlerts =
    activeTab === 'All'
      ? ACTIVE_ALERTS
      : ACTIVE_ALERTS.filter(
          (a) => a.severity.toLowerCase() === activeTab.toLowerCase(),
        );

  return (
    <div className="alerts">
      <PanelHeader title="ALERTS" onClose={onClose} onMaximize={onMaximize} />

      <div className="panel__body">
        {/* Stat tiles */}
        <div className="alerts__stats">
          <div className="alerts__stat-tile">
            <span className="alerts__stat-number">3</span>
            <span className="alerts__stat-label">ACTIVE</span>
          </div>
          <div className="alerts__stat-tile alerts__stat-tile--critical">
            <span className="alerts__stat-number">1</span>
            <span className="alerts__stat-label">CRITICAL</span>
          </div>
          <div className="alerts__stat-tile">
            <span className="alerts__stat-number">7</span>
            <span className="alerts__stat-label">THIS WEEK</span>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="alerts__filters">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`alerts__filter-tab${activeTab === tab ? ' alerts__filter-tab--active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Active alerts */}
        <div className="alerts__section">
          <span className="alerts__section-header">ACTIVE ALERTS</span>
          <div className="alerts__list">
            {filteredAlerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </div>

        {/* Resolved today */}
        <div className="alerts__section">
          <span className="alerts__section-header">RESOLVED TODAY</span>
          <div className="alerts__list">
            {RESOLVED_ALERTS.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
