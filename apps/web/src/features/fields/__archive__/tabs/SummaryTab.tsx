'use client';

import { useState } from 'react';
import {
  Cloud,
  CloudRain,
  Droplets,
  Thermometer,
  TrendingDown,
  BarChart3,
  ShieldCheck,
  Sun,
  CloudSun,
} from 'lucide-react';

/* ── Props ── */

interface SummaryTabProps {
  fieldName?: string;
}

/* ── Mock data ── */

const INDEX_PILLS = [
  { label: 'NDVI', group: 'spectral' },
  { label: 'NDRE', group: 'spectral' },
  { label: 'NDMI', group: 'spectral' },
  { label: 'Moisture', group: 'moisture' },
] as const;

const STAT_CARDS = [
  { icon: Cloud, label: 'Cloud cover', value: '1%', variant: '' },
  { icon: Droplets, label: 'Surface moisture', value: '25%', variant: 'warning' },
  { icon: Thermometer, label: 'Field state', value: 'Very dry', variant: 'danger' },
];

const CONDITIONS = [
  { icon: Droplets, label: 'Root Moisture', value: '22%', sub: 'Below threshold', danger: true },
  { icon: TrendingDown, label: 'Trend (7d)', value: '\u2014', sub: null, danger: false },
  { icon: BarChart3, label: 'Spread (\u03C3)', value: '\u2014', sub: null, danger: false },
  { icon: ShieldCheck, label: 'Confidence', value: '\u2014', sub: null, danger: false },
];

const ATMOSPHERE = [
  { icon: CloudRain, label: 'Precipitation', value: '\u2014', sub: null, danger: false },
  { icon: Cloud, label: 'Next Rain', value: '\u2014', sub: null, danger: false },
  { icon: Droplets, label: 'Rain Chance', value: '\u2014', sub: null, danger: false },
  { icon: CloudRain, label: '7-Day Total', value: '\u2014', sub: null, danger: false },
];

const ALERTS = [
  {
    id: '1',
    severity: 'critical' as const,
    title: 'Moisture Stress',
    subtitle: 'Root zone drying below crop threshold',
  },
  {
    id: '2',
    severity: 'warning' as const,
    title: 'Frost Risk Watch',
    subtitle: 'Overnight low forecast \u22122\u00B0C',
  },
];

const OUTLOOK_DAYS = [
  { day: 'Fri', icon: Sun, high: 14, low: -8, precip: '0%' },
  { day: 'Sat', icon: Sun, high: 13, low: 1, precip: '1%' },
  { day: 'Sun', icon: CloudSun, high: 12, low: 4, precip: '15%' },
  { day: 'Mon', icon: CloudRain, high: 10, low: 3, precip: '62%' },
];

/* ── Donut ── */

function Donut({ value, label }: { value: number; label: string }) {
  const size = 150;
  const sw = 5.68;
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - value);
  const pct = Math.round(value * 100);

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      {/* track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#ebebeb"
        strokeWidth={sw}
      />
      {/* fill */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#dc2626"
        strokeWidth={sw}
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      {/* center number */}
      <text
        x={size / 2}
        y={size / 2 - 10}
        textAnchor="middle"
        dominantBaseline="central"
        className="st__donut-value"
      >
        {pct}%
      </text>
      {/* label */}
      <text
        x={size / 2}
        y={size / 2 + 18}
        textAnchor="middle"
        dominantBaseline="central"
        className="st__donut-label"
      >
        {label}
      </text>
    </svg>
  );
}

/* ── Section header ── */

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="st__section-header">
      <span className="st__section-accent" />
      <span className="st__section-label">{label}</span>
    </div>
  );
}

/* ── Metric grid ── */

function MetricGrid({
  heading,
  meta,
  items,
}: {
  heading: string;
  meta?: string;
  items: typeof CONDITIONS;
}) {
  return (
    <div className="st__data-card">
      <div className="st__data-card-header">
        <span className="st__data-card-heading">{heading}</span>
        {meta && <span className="st__data-card-meta">{meta}</span>}
      </div>
      <div className="st__data-card-grid">
        {items.map((m) => (
          <div key={m.label} className="st__metric-cell">
            <div className="st__metric-top">
              <m.icon size={12} className="st__metric-icon" />
              <span className="st__metric-label">{m.label}</span>
            </div>
            <span className={`st__metric-value${m.danger ? ' st__metric-value--danger' : ''}`}>
              {m.value}
            </span>
            {m.sub && (
              <span className={`st__metric-sub${m.danger ? ' st__metric-sub--danger' : ''}`}>
                {m.sub}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Component ── */

export function SummaryTab({
  fieldName = 'Quarter SE 25 010 17 W4',
}: SummaryTabProps) {
  const [activeIndex, setActiveIndex] = useState<string>('Moisture');

  return (
    <div className="st__root">
      {/* 1. Title */}
      <div className="st__title-block">
        <h2 className="st__field-name">{fieldName}</h2>
        <p className="st__subtitle">
          SE 25-010-17 W4M &nbsp;&middot;&nbsp; Legal Land Description
        </p>
      </div>

      {/* 2. Index pills */}
      <div className="st__pills">
        {INDEX_PILLS.map((pill, i) => {
          const prev = INDEX_PILLS[i - 1];
          const showDivider = prev && prev.group !== pill.group;
          return (
            <div key={pill.label} className="st__pills-item">
              {showDivider && <span className="st__pills-divider" />}
              <button
                type="button"
                className={`st__pill${pill.label === activeIndex ? ' st__pill--active' : ''}`}
                onClick={() => setActiveIndex(pill.label)}
              >
                {pill.label}
              </button>
            </div>
          );
        })}
      </div>

      {/* 3. Field overview */}
      <div className="st__overview">
        <SectionHeader label="Field overview" />
        <div className="st__overview-body">
          <div className="st__overview-donut">
            <Donut value={0.22} label="Root moisture" />
          </div>
          <div className="st__overview-stats">
            {STAT_CARDS.map((card) => (
              <div key={card.label} className="st__stat-card">
                <span className="st__stat-card-icon">
                  <card.icon size={12} color="#6b7280" />
                </span>
                <div className="st__stat-card-text">
                  <span className="st__stat-card-label">{card.label}</span>
                  <span className={`st__stat-card-value${card.variant ? ` st__stat-card-value--${card.variant}` : ''}`}>
                    {card.value}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Conditions */}
      <MetricGrid heading="CONDITIONS" meta="Field average" items={CONDITIONS} />

      {/* 5. Atmosphere */}
      <MetricGrid heading="ATMOSPHERE" items={ATMOSPHERE} />

      {/* 6. Active Alerts */}
      <div className="st__alerts">
        <div className="st__alerts-header">
          <span className="st__alerts-label">ACTIVE ALERTS</span>
          <span className="st__alerts-count">2 active</span>
        </div>
        <div className="st__alerts-list">
          {ALERTS.map((alert) => (
            <div key={alert.id} className="st__alert-card">
              <div className="st__alert-icon">
                {alert.severity === 'critical' ? (
                  <Droplets size={16} color="#ef4444" />
                ) : (
                  <Thermometer size={16} color="#f59e0b" />
                )}
              </div>
              <div className="st__alert-content">
                <span className="st__alert-title">{alert.title}</span>
                <span className="st__alert-subtitle">{alert.subtitle}</span>
              </div>
              <span className={`st__alert-badge st__alert-badge--${alert.severity}`}>
                {alert.severity === 'critical' ? 'High' : 'Medium'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 7. 7-Day Outlook */}
      <div className="st__outlook">
        <span className="st__data-card-heading">7-DAY OUTLOOK</span>
        <div className="st__outlook-strip">
          {OUTLOOK_DAYS.map((d) => (
            <div key={d.day} className="st__outlook-day">
              <span className="st__outlook-day-label">{d.day}</span>
              <d.icon size={16} className="st__outlook-day-icon" />
              <span className="st__outlook-day-temps">
                {d.high}/{d.low}
              </span>
              <span className="st__outlook-day-precip">{d.precip}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
