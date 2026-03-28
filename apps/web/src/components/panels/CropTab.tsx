'use client';

import { CheckCircle, XCircle, TriangleAlert, Bug, Thermometer, Droplets } from 'lucide-react';
import { DonutChart } from '../ui/DonutChart';

/* ── Threshold table data ── */
type ThresholdStatus = 'ok' | 'warn' | 'danger';

interface ThresholdRow {
  param: string;
  min: string;
  optimal: string;
  max: string;
  status: ThresholdStatus;
  optColor: string;
}

const THRESHOLDS: ThresholdRow[] = [
  { param: 'Soil Temp (°C)',   min: '5',  optimal: '12–18',   max: '30',  status: 'ok',     optColor: '#16a34a' },
  { param: 'Soil Moisture (%)', min: '30', optimal: '50–70',   max: '85',  status: 'warn',   optColor: '#f59e0b' },
  { param: 'pH Level',          min: '6.0', optimal: '6.5–7.5', max: '8.0', status: 'ok',     optColor: '#16a34a' },
  { param: 'Nitrogen (kg/ha)',  min: '80', optimal: '120–160',  max: '200', status: 'danger', optColor: '#ef4444' },
  { param: 'Rainfall (mm/wk)',  min: '15', optimal: '25–40',    max: '60',  status: 'ok',     optColor: '#16a34a' },
];

const STATUS_BORDER: Record<ThresholdStatus, string> = {
  ok: 'rgba(22,163,74,0.27)',
  warn: 'rgba(245,158,11,0.27)',
  danger: 'rgba(239,68,68,0.27)',
};

/* ── Disease data ── */
interface DiseaseCard {
  name: string;
  desc: string;
  pct: string;
  color: string;
  bg: string;
}

const DISEASES: DiseaseCard[] = [
  { name: 'Blackleg (Leptosphaeria)', desc: 'Risk: HIGH — warm humid conditions, spore count elevated', pct: '78%', color: '#ef4444', bg: '#fef2f2' },
  { name: 'Sclerotinia Stem Rot',     desc: 'Risk: MODERATE — flowering stage vulnerability window',    pct: '45%', color: '#f59e0b', bg: '#fffbeb' },
  { name: 'Clubroot (Plasmodiophora)', desc: 'Risk: LOW — resistant cultivar, pH managed',              pct: '12%', color: '#16a34a', bg: '#f0fdf4' },
];

/* ── SAR rows ── */
const SAR_ROWS = [
  { k: 'Satellite',       v: 'Sentinel-1A' },
  { k: 'Pass Direction',  v: 'Ascending' },
  { k: 'Polarisation',    v: 'VV + VH' },
  { k: 'Last Capture',    v: '2025-03-25 06:42 UTC' },
  { k: 'Resolution',      v: '10m × 10m' },
];

/* ── Field status tiles ── */
interface StatusTile {
  label: string;
  value: string;
  sub: string;
  valueColor: string;
  bg: string;
  border: string;
}

const FIELD_TILES: StatusTile[] = [
  { label: 'FROST RISK',         value: 'High',  sub: 'Min temp: -2°C tonight',  valueColor: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
  { label: 'SEEDING READINESS',  value: 'Ready', sub: 'Soil temp > 5°C for 5d',  valueColor: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  { label: 'ET₀ (mm/day)',       value: '3.8',   sub: 'Penman-Monteith',         valueColor: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
  { label: 'WATER BALANCE',      value: '+12mm', sub: 'Surplus this week',       valueColor: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
];

/* ── Alert cards ── */
interface AlertCard {
  icon: typeof Thermometer;
  iconColor: string;
  bg: string;
  title: string;
  desc: string;
}

const ALERTS: AlertCard[] = [
  { icon: Thermometer, iconColor: '#ef4444', bg: '#fef2f2', title: 'Frost Warning — protect exposed fields', desc: 'Tonight 02:00–06:00 · -2°C expected' },
  { icon: Droplets,    iconColor: '#f59e0b', bg: '#fffbeb', title: 'Nitrogen deficiency detected in NW zone', desc: 'Recommend foliar application within 48h' },
];

/* ── Growth stages ── */
const STAGES = [
  { label: 'Germ',    active: false, color: '#4ade80' },
  { label: 'Rosette', active: false, color: '#4ade80' },
  { label: 'Flower',  active: true,  color: '#16a34a' },
  { label: 'Pod',     active: false, color: '#d4d4d4' },
  { label: 'Mature',  active: false, color: '#d4d4d4' },
];

/* ── Status icon helper ── */
function StatusIcon({ status }: { status: ThresholdStatus }) {
  if (status === 'ok')     return <CheckCircle size={14} color="#16a34a" />;
  if (status === 'warn')   return <TriangleAlert size={14} color="#f59e0b" />;
  return <XCircle size={14} color="#ef4444" />;
}

export function CropTab() {
  return (
    <div className="panel__body">
      {/* ── Title ── */}
      <div className="panel__title-section">
        <h2 className="panel__title-main">Canola</h2>
        <span className="panel__title-sub">SE 25-010-17 W4M &middot; Legal Land Description</span>
      </div>

      {/* ── Growth Stage ── */}
      <div className="crop-section">
        <span className="crop-section__label">GROWTH STAGE</span>

        {/* stage bar */}
        <div className="crop-stage-bar">
          {STAGES.map((s) => (
            <div
              key={s.label}
              className="crop-stage-bar__segment"
              style={{ background: s.color }}
            />
          ))}
        </div>

        {/* stage labels */}
        <div className="crop-stage-labels">
          {STAGES.map((s) => (
            <span
              key={s.label}
              className="crop-stage-labels__item"
              style={{
                color: s.active ? '#16a34a' : '#8a8f98',
                fontWeight: s.active ? 700 : 400,
              }}
            >
              {s.label}
            </span>
          ))}
        </div>

        {/* GDD value */}
        <div className="crop-gdd">
          <span className="crop-gdd__value">1,247</span>
          <span className="crop-gdd__unit">GDD accumulated (base 5°C)</span>
        </div>
      </div>

      {/* ── Crop Thresholds ── */}
      <div className="crop-section crop-section--no-pad">
        <div className="crop-thresh__header">
          <span className="crop-section__label">CROP THRESHOLDS</span>
          <span className="crop-thresh__stage">Rosette Stage</span>
        </div>

        {/* column header */}
        <div className="crop-thresh__col-hdr">
          <span className="crop-thresh__col crop-thresh__col--param">Parameter</span>
          <span className="crop-thresh__col crop-thresh__col--num">Min</span>
          <span className="crop-thresh__col crop-thresh__col--num">Optimal</span>
          <span className="crop-thresh__col crop-thresh__col--num">Max</span>
          <span className="crop-thresh__col crop-thresh__col--status">Status</span>
        </div>

        {/* rows */}
        {THRESHOLDS.map((r, i) => (
          <div
            key={r.param}
            className="crop-thresh__row"
            style={{
              borderLeft: `3px solid ${STATUS_BORDER[r.status]}`,
              borderRadius: i === THRESHOLDS.length - 1 ? '0 0 10px 10px' : undefined,
            }}
          >
            <span className="crop-thresh__row-param">{r.param}</span>
            <span className="crop-thresh__row-num">{r.min}</span>
            <span className="crop-thresh__row-num" style={{ color: r.optColor }}>{r.optimal}</span>
            <span className="crop-thresh__row-num">{r.max}</span>
            <span className="crop-thresh__row-status"><StatusIcon status={r.status} /></span>
          </div>
        ))}
      </div>

      {/* ── NDVI Health Index ── */}
      <div className="crop-section">
        <span className="crop-section__label">NDVI HEALTH INDEX</span>
        <div className="donut-container">
          <DonutChart value={0.72} label="0.72" caption="NDVI" size={150} color="#16a34a" />
          <div className="donut-info">
            <div className="donut-info__row">
              <div className="donut-info__text">
                <span className="donut-info__label">Health</span>
                <span className="donut-info__value" style={{ color: '#16a34a' }}>Healthy</span>
              </div>
            </div>
            <div className="donut-info__row">
              <div className="donut-info__text">
                <span className="donut-info__label">Δ 7d</span>
                <span className="donut-info__value" style={{ color: '#16a34a' }}>+0.04</span>
              </div>
            </div>
            <div className="donut-info__row">
              <div className="donut-info__text">
                <span className="donut-info__label">Stage range</span>
                <span className="donut-info__value" style={{ color: '#6b7280' }}>0.55–0.85</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Crop Moisture Balance ── */}
      <div className="crop-section">
        <span className="crop-section__label">CROP MOISTURE BALANCE</span>
        <div className="donut-container">
          <DonutChart value={0.62} label="62%" caption="Moisture" size={150} color="#3b82f6" />
          <div className="donut-info">
            <div className="donut-info__row">
              <div className="donut-info__text">
                <span className="donut-info__label">Status</span>
                <span className="donut-info__value" style={{ color: '#3b82f6' }}>Field Capacity</span>
              </div>
            </div>
            <div className="donut-info__row">
              <div className="donut-info__text">
                <span className="donut-info__label">Optimal</span>
                <span className="donut-info__value" style={{ color: '#16a34a' }}>50–70%</span>
              </div>
            </div>
            <div className="donut-info__row">
              <div className="donut-info__text">
                <span className="donut-info__label">Source</span>
                <span className="donut-info__value" style={{ color: '#6b7280' }}>TDR sensor</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Field Status Indicators ── */}
      <div className="crop-section">
        <span className="crop-section__label">FIELD STATUS INDICATORS</span>
        <div className="crop-fs-grid">
          {FIELD_TILES.map((t) => (
            <div
              key={t.label}
              className="crop-fs-tile"
              style={{ background: t.bg, borderColor: t.border }}
            >
              <span className="crop-fs-tile__label">{t.label}</span>
              <span className="crop-fs-tile__value" style={{ color: t.valueColor }}>{t.value}</span>
              <span className="crop-fs-tile__sub">{t.sub}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Disease Model Risk ── */}
      <div className="crop-section crop-section--gap-8">
        <span className="crop-section__label">DISEASE MODEL RISK</span>
        {DISEASES.map((d) => (
          <div key={d.name} className="crop-disease" style={{ background: d.bg }}>
            <Bug size={18} color={d.color} style={{ flexShrink: 0 }} />
            <div className="crop-disease__body">
              <span className="crop-disease__name">{d.name}</span>
              <span className="crop-disease__desc" style={{ color: d.color }}>{d.desc}</span>
            </div>
            <span className="crop-disease__pct" style={{ color: d.color }}>{d.pct}</span>
          </div>
        ))}
      </div>

      {/* ── SAR Data Provenance ── */}
      <div className="crop-section crop-section--gap-8">
        <span className="crop-section__label">SAR DATA PROVENANCE</span>
        {SAR_ROWS.map((r) => (
          <div key={r.k} className="crop-sar-row">
            <span className="crop-sar-row__key">{r.k}</span>
            <span className="crop-sar-row__val">{r.v}</span>
          </div>
        ))}
        <div className="crop-sar-chips">
          <span className="crop-sar-chip" style={{ background: '#e0e7ff', color: '#4338ca' }}>Copernicus Open Access</span>
          <span className="crop-sar-chip" style={{ background: '#dbeafe', color: '#1d4ed8' }}>Level-1 GRD</span>
        </div>
      </div>

      {/* ── Active Crop Alerts ── */}
      <div className="crop-section crop-section--gap-8">
        <span className="crop-section__label">ACTIVE CROP ALERTS</span>
        {ALERTS.map((a) => (
          <div key={a.title} className="crop-alert" style={{ background: a.bg }}>
            <a.icon size={14} color={a.iconColor} style={{ flexShrink: 0, marginTop: 2 }} />
            <div className="crop-alert__body">
              <span className="crop-alert__title">{a.title}</span>
              <span className="crop-alert__desc">{a.desc}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Timestamp footer ── */}
      <p className="crop-timestamp">
        Last updated: 2025-03-27 08:14 UTC · Sentinel-2 + ground sensors
      </p>
    </div>
  );
}
