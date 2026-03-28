'use client';

import {
  Bug,
  CircleCheck,
  CircleX,
  Droplets,
  Thermometer,
  TriangleAlert,
} from 'lucide-react';

/* ── Growth-stage segments (from Pencil: 5 segments) ── */

type GrowthSegment = {
  label: string;
  activeColor: string;
  inactiveColor: string;
};

const GROWTH_SEGMENTS: GrowthSegment[] = [
  { label: 'Germ',    activeColor: '#4ade80', inactiveColor: '#d4d4d4' },
  { label: 'Rosette', activeColor: '#4ade80', inactiveColor: '#d4d4d4' },
  { label: 'Flower',  activeColor: '#16a34a', inactiveColor: '#d4d4d4' },
  { label: 'Pod',     activeColor: '#d4d4d4', inactiveColor: '#d4d4d4' },
  { label: 'Mature',  activeColor: '#d4d4d4', inactiveColor: '#d4d4d4' },
];

/* ── Threshold row data ── */

type ThresholdRow = {
  param: string;
  min: string;
  optimal: string;
  optimalColor: string;
  max: string;
  status: 'ok' | 'warn' | 'danger';
  borderColor: string;
};

const THRESHOLD_ROWS: ThresholdRow[] = [
  { param: 'Soil Temp (\u00b0C)',   min: '5',  optimal: '12\u201318',  optimalColor: '#16a34a', max: '30',  status: 'ok',     borderColor: '#16a34a44' },
  { param: 'Soil Moisture (%)', min: '30', optimal: '50\u201370',  optimalColor: '#f59e0b', max: '85',  status: 'warn',   borderColor: '#f59e0b44' },
  { param: 'pH Level',          min: '6.0',optimal: '6.5\u20137.5', optimalColor: '#16a34a', max: '8.0', status: 'ok',     borderColor: '#16a34a44' },
  { param: 'Nitrogen (kg/ha)',  min: '80', optimal: '120\u2013160', optimalColor: '#ef4444', max: '200', status: 'danger', borderColor: '#ef444444' },
  { param: 'Rainfall (mm/wk)',  min: '15', optimal: '25\u201340',  optimalColor: '#16a34a', max: '60',  status: 'ok',     borderColor: '#16a34a44' },
];

/* ── Inline donut — exact Pencil tokens ── */

function CropDonut({
  value,
  label,
  subLabel,
  fillColor,
}: {
  value: number;
  label: string;
  subLabel: string;
  fillColor: string;
}) {
  const size = 150;
  const strokeWidth = 5.684;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - value);

  return (
    <svg width={size} height={size} className="ct__donut-svg">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#e8e8e8"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={fillColor}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x={size / 2}
        y={size / 2 - 6}
        textAnchor="middle"
        dominantBaseline="central"
        className="ct__donut-value-text"
      >
        {label}
      </text>
      <text
        x={size / 2}
        y={size / 2 + 14}
        textAnchor="middle"
        dominantBaseline="central"
        className="ct__donut-sub-text"
      >
        {subLabel}
      </text>
    </svg>
  );
}

/* ── Metric tile used beside donuts ── */

function MetricTile({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor: string;
}) {
  return (
    <div className="ct__metric-tile">
      <span className="ct__metric-tile-label">{label}</span>
      <span className="ct__metric-tile-value" style={{ color: valueColor }}>
        {value}
      </span>
    </div>
  );
}

/* ── Status icon for threshold rows ── */

function StatusIcon({ status }: { status: 'ok' | 'warn' | 'danger' }) {
  if (status === 'ok') return <CircleCheck size={14} color="#16a34a" />;
  if (status === 'warn') return <TriangleAlert size={14} color="#f59e0b" />;
  return <CircleX size={14} color="#ef4444" />;
}

/* ── Component ── */

export function CropTab() {
  const currentStageIdx = 2; // Flower

  return (
    <div className="ct__container">
      {/* 1. Title */}
      <div className="ct__title-section">
        <h2 className="ct__crop-name">Canola</h2>
        <span className="ct__subtitle">
          SE 25-010-17 W4M &nbsp;&middot;&nbsp; Legal Land Description
        </span>
      </div>

      {/* 2. Growth Stage */}
      <section className="ct__card">
        <span className="ct__section-label">GROWTH STAGE</span>

        {/* Segmented bar */}
        <div className="ct__growth-bar">
          {GROWTH_SEGMENTS.map((seg, i) => (
            <div
              key={seg.label}
              className="ct__growth-segment"
              style={{
                background: i <= currentStageIdx ? seg.activeColor : seg.inactiveColor,
                borderRadius:
                  i === 0
                    ? '4px 0 0 4px'
                    : i === GROWTH_SEGMENTS.length - 1
                      ? '0 4px 4px 0'
                      : undefined,
              }}
            />
          ))}
        </div>

        {/* Stage labels */}
        <div className="ct__stage-labels">
          {GROWTH_SEGMENTS.map((seg, i) => (
            <span
              key={seg.label}
              className="ct__stage-label"
              style={{
                fontWeight: i === currentStageIdx ? 700 : 400,
                color: i === currentStageIdx ? '#16a34a' : '#8a8f98',
              }}
            >
              {seg.label}
            </span>
          ))}
        </div>

        {/* GDD value */}
        <div className="ct__gdd-val">
          <span className="ct__gdd-number">1,247</span>
          <span className="ct__gdd-unit">GDD accumulated (base 5&deg;C)</span>
        </div>
      </section>

      {/* 3. Crop Thresholds */}
      <section className="ct__card ct__card--no-pad">
        <div className="ct__thresh-hdr">
          <span className="ct__section-label">CROP THRESHOLDS</span>
          <span className="ct__thresh-stage">Rosette Stage</span>
        </div>

        {/* Column header */}
        <div className="ct__col-hdr">
          <span className="ct__col-hdr-cell ct__col-hdr-cell--param">Parameter</span>
          <span className="ct__col-hdr-cell ct__col-hdr-cell--num">Min</span>
          <span className="ct__col-hdr-cell ct__col-hdr-cell--num">Optimal</span>
          <span className="ct__col-hdr-cell ct__col-hdr-cell--num">Max</span>
          <span className="ct__col-hdr-cell ct__col-hdr-cell--status">Status</span>
        </div>

        {/* Rows */}
        {THRESHOLD_ROWS.map((row, i) => (
          <div
            key={row.param}
            className="ct__thresh-row"
            style={{
              borderLeft: `3px solid ${row.borderColor}`,
              borderRadius: i === THRESHOLD_ROWS.length - 1 ? '0 0 10px 10px' : undefined,
            }}
          >
            <span className="ct__thresh-param">{row.param}</span>
            <span className="ct__thresh-num">{row.min}</span>
            <span className="ct__thresh-num" style={{ color: row.optimalColor }}>
              {row.optimal}
            </span>
            <span className="ct__thresh-num">{row.max}</span>
            <span className="ct__thresh-status">
              <StatusIcon status={row.status} />
            </span>
          </div>
        ))}
      </section>

      {/* 4. NDVI Health Index */}
      <section className="ct__card">
        <span className="ct__section-label">NDVI HEALTH INDEX</span>
        <div className="ct__donut-wrapper">
          <CropDonut value={0.72} label="0.72" subLabel="NDVI" fillColor="#16a34a" />
          <div className="ct__metric-tiles">
            <MetricTile label="Health" value="Healthy" valueColor="#16a34a" />
            <MetricTile label={'\u0394 7d'} value="+0.04" valueColor="#16a34a" />
            <MetricTile label="Stage range" value="0.55\u20130.85" valueColor="#6b7280" />
          </div>
        </div>
      </section>

      {/* 5. Crop Moisture Balance */}
      <section className="ct__card">
        <span className="ct__section-label">CROP MOISTURE BALANCE</span>
        <div className="ct__donut-wrapper">
          <CropDonut value={0.62} label="62%" subLabel="Moisture" fillColor="#3b82f6" />
          <div className="ct__metric-tiles">
            <MetricTile label="Status" value="Field Capacity" valueColor="#3b82f6" />
            <MetricTile label="Optimal" value="50\u201370%" valueColor="#16a34a" />
            <MetricTile label="Source" value="TDR sensor" valueColor="#6b7280" />
          </div>
        </div>
      </section>

      {/* 6. Field Status Indicators */}
      <section className="ct__card">
        <span className="ct__section-label">FIELD STATUS INDICATORS</span>
        <div className="ct__fs-grid">
          <div className="ct__fs-row">
            <div className="ct__fs-tile ct__fs-tile--red">
              <span className="ct__fs-tile-label">FROST RISK</span>
              <span className="ct__fs-tile-value" style={{ color: '#ef4444' }}>High</span>
              <span className="ct__fs-tile-sub">Min temp: -2&deg;C tonight</span>
            </div>
            <div className="ct__fs-tile ct__fs-tile--green">
              <span className="ct__fs-tile-label">SEEDING READINESS</span>
              <span className="ct__fs-tile-value" style={{ color: '#16a34a' }}>Ready</span>
              <span className="ct__fs-tile-sub">Soil temp &gt; 5&deg;C for 5d</span>
            </div>
          </div>
          <div className="ct__fs-row">
            <div className="ct__fs-tile ct__fs-tile--blue">
              <span className="ct__fs-tile-label">ET&#x2080; (mm/day)</span>
              <span className="ct__fs-tile-value" style={{ color: '#3b82f6' }}>3.8</span>
              <span className="ct__fs-tile-sub">Penman-Monteith</span>
            </div>
            <div className="ct__fs-tile ct__fs-tile--green">
              <span className="ct__fs-tile-label">WATER BALANCE</span>
              <span className="ct__fs-tile-value" style={{ color: '#16a34a' }}>+12mm</span>
              <span className="ct__fs-tile-sub">Surplus this week</span>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Disease Model Risk */}
      <section className="ct__card">
        <span className="ct__section-label">DISEASE MODEL RISK</span>

        <div className="ct__dis-card ct__dis-card--red">
          <Bug size={18} color="#ef4444" />
          <div className="ct__dis-body">
            <span className="ct__dis-title">Blackleg (Leptosphaeria)</span>
            <span className="ct__dis-desc" style={{ color: '#ef4444' }}>
              Risk: HIGH &mdash; warm humid conditions, spore count elevated
            </span>
          </div>
          <span className="ct__dis-pct" style={{ color: '#ef4444' }}>78%</span>
        </div>

        <div className="ct__dis-card ct__dis-card--amber">
          <Bug size={18} color="#f59e0b" />
          <div className="ct__dis-body">
            <span className="ct__dis-title">Sclerotinia Stem Rot</span>
            <span className="ct__dis-desc" style={{ color: '#f59e0b' }}>
              Risk: MODERATE &mdash; flowering stage vulnerability window
            </span>
          </div>
          <span className="ct__dis-pct" style={{ color: '#f59e0b' }}>45%</span>
        </div>

        <div className="ct__dis-card ct__dis-card--green">
          <Bug size={18} color="#16a34a" />
          <div className="ct__dis-body">
            <span className="ct__dis-title">Clubroot (Plasmodiophora)</span>
            <span className="ct__dis-desc" style={{ color: '#16a34a' }}>
              Risk: LOW &mdash; resistant cultivar, pH managed
            </span>
          </div>
          <span className="ct__dis-pct" style={{ color: '#16a34a' }}>12%</span>
        </div>
      </section>

      {/* 8. SAR Data Provenance */}
      <section className="ct__card">
        <span className="ct__section-label">SAR DATA PROVENANCE</span>

        <div className="ct__sar-row">
          <span className="ct__sar-key">Satellite</span>
          <span className="ct__sar-val">Sentinel-1A</span>
        </div>
        <div className="ct__sar-row">
          <span className="ct__sar-key">Pass Direction</span>
          <span className="ct__sar-val">Ascending</span>
        </div>
        <div className="ct__sar-row">
          <span className="ct__sar-key">Polarisation</span>
          <span className="ct__sar-val">VV + VH</span>
        </div>
        <div className="ct__sar-row">
          <span className="ct__sar-key">Last Capture</span>
          <span className="ct__sar-val">2025-03-25 06:42 UTC</span>
        </div>
        <div className="ct__sar-row">
          <span className="ct__sar-key">Resolution</span>
          <span className="ct__sar-val">10m &times; 10m</span>
        </div>

        <div className="ct__sar-chips">
          <span className="ct__sar-chip ct__sar-chip--indigo">Copernicus Open Access</span>
          <span className="ct__sar-chip ct__sar-chip--blue">Level-1 GRD</span>
        </div>
      </section>

      {/* 9. Active Crop Alerts */}
      <section className="ct__card">
        <span className="ct__section-label">ACTIVE CROP ALERTS</span>

        <div className="ct__alert-row ct__alert-row--red">
          <Thermometer size={14} color="#ef4444" />
          <div className="ct__alert-body">
            <span className="ct__alert-title">
              Frost Warning &mdash; protect exposed fields
            </span>
            <span className="ct__alert-desc">
              Tonight 02:00&ndash;06:00 &middot; -2&deg;C expected
            </span>
          </div>
        </div>

        <div className="ct__alert-row ct__alert-row--amber">
          <Droplets size={14} color="#f59e0b" />
          <div className="ct__alert-body">
            <span className="ct__alert-title">
              Nitrogen deficiency detected in NW zone
            </span>
            <span className="ct__alert-desc">
              Recommend foliar application within 48h
            </span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <div className="ct__footer">
        Last updated: 2025-03-27 08:14 UTC &middot; Sentinel-2 + ground sensors
      </div>
    </div>
  );
}
