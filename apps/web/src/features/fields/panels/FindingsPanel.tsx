'use client';

import { PanelHeader } from '../../../components/ui/PanelHeader';
import {
  AlertTriangle,
  Droplets,
  Expand,
  Leaf,
  ShieldAlert,
  Grid3X3,
  Merge,
} from 'lucide-react';

/* ── Types ── */

type FindingSeverity = 'critical' | 'warning' | 'info' | 'resolved';

interface Finding {
  id: string;
  title: string;
  details: string;
  severity: FindingSeverity;
  badgeLabel: string;
  icon: React.ReactNode;
}

interface ZoneBar {
  zone: string;
  count: number;
  color: string;
}

interface TrendDay {
  label: string;
  segments: { height: number; color: string }[];
}

/* ── Static data ── */

const SUMMARY_TILES: {
  count: number;
  label: string;
  severity: FindingSeverity;
}[] = [
  { count: 1, label: 'Critical', severity: 'critical' },
  { count: 3, label: 'Warning', severity: 'warning' },
  { count: 2, label: 'Info', severity: 'info' },
  { count: 4, label: 'Resolved', severity: 'resolved' },
];

const ZONE_BARS: ZoneBar[] = [
  { zone: 'NE-2', count: 3, color: '#ef4444' },
  { zone: 'SW-1', count: 2, color: '#ef4444' },
  { zone: 'NW-3', count: 1, color: '#f97316' },
];

const FINDINGS: Finding[] = [
  {
    id: '1',
    title: 'Critical Moisture Drop',
    details: 'var 1 · ebb · -12 wp. · 01 · 5h ago',
    severity: 'critical',
    badgeLabel: 'CRIT',
    icon: <Droplets size={16} />,
  },
  {
    id: '2',
    title: 'Stress Pattern Expanding',
    details: 'NE-2 · 4 cells · 8h ago',
    severity: 'warning',
    badgeLabel: 'Health',
    icon: <Expand size={16} />,
  },
  {
    id: '3',
    title: 'Disease Risk Threshold',
    details: 'NE-3 · NDVI/NDRE 15% · Lat: 48',
    severity: 'info',
    badgeLabel: 'Info',
    icon: <ShieldAlert size={16} />,
  },
  {
    id: '4',
    title: 'Persistent Dry Stress',
    details: 'NE-3 · 5 readings below avg · Mar 24',
    severity: 'warning',
    badgeLabel: 'Health',
    icon: <Leaf size={16} />,
  },
  {
    id: '5',
    title: 'New Zone Detected',
    details: 'S-6 · 3 cells · 1d ago',
    severity: 'info',
    badgeLabel: 'Info',
    icon: <Grid3X3 size={16} />,
  },
  {
    id: '6',
    title: 'Zones Merged',
    details: 'NE 2 · > · 12 cells · Mar 25',
    severity: 'info',
    badgeLabel: 'Info',
    icon: <Merge size={16} />,
  },
];

const TREND_DAYS: TrendDay[] = [
  {
    label: 'M',
    segments: [
      { height: 18, color: '#ef4444' },
      { height: 10, color: '#f59e0b' },
    ],
  },
  {
    label: 'T',
    segments: [
      { height: 8, color: '#f59e0b' },
      { height: 14, color: '#3b82f6' },
    ],
  },
  {
    label: 'W',
    segments: [
      { height: 12, color: '#ef4444' },
      { height: 6, color: '#f59e0b' },
      { height: 8, color: '#3b82f6' },
    ],
  },
  {
    label: 'T',
    segments: [
      { height: 4, color: '#f59e0b' },
      { height: 20, color: '#3b82f6' },
    ],
  },
  {
    label: 'F',
    segments: [
      { height: 16, color: '#ef4444' },
      { height: 6, color: '#3b82f6' },
    ],
  },
  {
    label: 'S',
    segments: [{ height: 10, color: '#16a34a' }],
  },
  {
    label: 'S',
    segments: [
      { height: 6, color: '#f59e0b' },
      { height: 4, color: '#16a34a' },
    ],
  },
];

const MAX_ZONE_COUNT = Math.max(...ZONE_BARS.map((z) => z.count));

/* ── Sub-components ── */

function SummaryTile({
  count,
  label,
  severity,
}: {
  count: number;
  label: string;
  severity: FindingSeverity;
}) {
  return (
    <div className={`findings__tile findings__tile--${severity}`}>
      <span className="findings__tile-count">{count}</span>
      <span className="findings__tile-label">{label}</span>
    </div>
  );
}

function FindingCard({ finding }: { finding: Finding }) {
  return (
    <div
      className={`findings__card findings__card--${finding.severity}`}
    >
      <div className="findings__card-top">
        <span className="findings__card-icon">{finding.icon}</span>
        <span className="findings__card-title">{finding.title}</span>
        <span
          className={`findings__badge findings__badge--${finding.severity}`}
        >
          {finding.badgeLabel}
        </span>
      </div>
      <span className="findings__card-details">{finding.details}</span>
    </div>
  );
}

/* ── Main panel ── */

interface FindingsPanelProps {
  onClose?: () => void;
  onMaximize?: () => void;
}

export function FindingsPanel({ onClose, onMaximize }: FindingsPanelProps) {
  return (
    <div className="findings">
      <PanelHeader
        title="FINDINGS"
        onClose={onClose}
        onMaximize={onMaximize}
      />

      <div className="panel__body">
        {/* Title */}
        <div className="findings__title-block">
          <h2 className="findings__title">Findings Overview</h2>
          <span className="findings__subtitle">
            Quarter SE 25 · Last 7 days
          </span>
        </div>

        {/* Summary stat tiles */}
        <div className="findings__tiles-row">
          {SUMMARY_TILES.map((t) => (
            <SummaryTile
              key={t.label}
              count={t.count}
              label={t.label}
              severity={t.severity}
            />
          ))}
        </div>

        {/* Most affected zones */}
        <div className="findings__section">
          <h3 className="findings__section-header">
            MOST AFFECTED ZONES{' '}
            <span className="findings__section-hint">(finding count)</span>
          </h3>
          <div className="findings__zones">
            {ZONE_BARS.map((z) => (
              <div key={z.zone} className="findings__zone-row">
                <span className="findings__zone-label">{z.zone}</span>
                <div className="findings__zone-track">
                  <div
                    className="findings__zone-bar"
                    style={{
                      width: `${(z.count / MAX_ZONE_COUNT) * 100}%`,
                      background: z.color,
                    }}
                  />
                </div>
                <span className="findings__zone-count">{z.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Active findings */}
        <div className="findings__section">
          <h3 className="findings__section-header">
            ACTIVE FINDINGS{' '}
            <span className="findings__section-hint">
              ({FINDINGS.length} total)
            </span>
          </h3>
          <div className="findings__list">
            {FINDINGS.map((f) => (
              <FindingCard key={f.id} finding={f} />
            ))}
          </div>
        </div>

        {/* 7-day trend */}
        <div className="findings__section">
          <h3 className="findings__section-header">7-DAY TREND</h3>
          <span className="findings__trend-label">findings per day</span>
          <div className="findings__trend-chart">
            {TREND_DAYS.map((day, i) => (
              <div key={i} className="findings__trend-col">
                <div className="findings__trend-stack">
                  {day.segments.map((seg, j) => (
                    <div
                      key={j}
                      className="findings__trend-seg"
                      style={{
                        height: `${seg.height}px`,
                        background: seg.color,
                      }}
                    />
                  ))}
                </div>
                <span className="findings__trend-day">{day.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer timestamp */}
        <div className="findings__footer">
          <AlertTriangle size={12} />
          <span>Last updated Mar 28, 2026 · 09:14 AM</span>
        </div>
      </div>
    </div>
  );
}

export default FindingsPanel;
