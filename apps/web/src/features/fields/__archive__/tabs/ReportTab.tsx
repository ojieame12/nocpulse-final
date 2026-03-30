'use client';

import {
  Thermometer,
  Sun,
  Droplets,
  Wind,
  Leaf,
  TriangleAlert,
  FileDown,
  CircleCheck,
} from 'lucide-react';

/* ── Demo Data ── */

const READINGS = [
  { icon: Thermometer, iconColor: '#ef4444', label: 'Temperature', value: '13.0°C' },
  { icon: Sun, iconColor: '#f59e0b', label: 'Soil Temp', value: '8.2°C' },
  { icon: Droplets, iconColor: '#3b82f6', label: 'Root Moisture', value: '38.4%' },
  { icon: Wind, iconColor: '#6b7280', label: 'Wind', value: '18 km/h' },
  { icon: Leaf, iconColor: '#16a34a', label: 'NDVI', value: '0.72', valueColor: '#16a34a' },
  { icon: TriangleAlert, iconColor: '#f59e0b', label: 'Stress Area', value: '4.1%', valueColor: '#16a34a' },
];

const CROP_PARAMS = [
  { label: 'Root Moisture (%)', value: '20.5%', pct: 42 },
  { label: 'Soil Temp (°C)', value: '20.5%', pct: 55 },
  { label: 'Ambient Temp (°C)', value: '20.5%', pct: 38 },
  { label: 'VPD (kPa)', value: '20.5%', pct: 60 },
];

const NDVI_TREND_DATA = {
  dates: ['Feb 1', 'Feb 15', 'Mar 1', 'Mar 15', 'Mar 28'],
  fieldAvg: [0.32, 0.38, 0.44, 0.47, 0.49],
  zoneNW3: [0.35, 0.41, 0.48, 0.52, 0.55],
};

const MOISTURE_DATA = {
  dates: ['Feb 1', 'Feb 15', 'Mar 1', 'Mar 15', 'Mar 28'],
  rootZone: [28, 26, 24, 23, 22],
  surface: [18, 16, 15, 14, 13],
};

const TEMP_DATA = {
  dates: ['Feb 1', 'Feb 15', 'Mar 1', 'Mar 15', 'Mar 28'],
  surface: [6, 8, 10, 12, 13],
  rootZone: [4, 5, 7, 8, 8.5],
};

const FORECAST = [
  { day: 'Fri', icon: '☀️', temps: '14/-8', precip: '0%' },
  { day: 'Sat', icon: '☀️', temps: '13/1', precip: '1%' },
  { day: 'Sun', icon: '☀️', temps: '8/-3', precip: '9%' },
  { day: 'Mon', icon: '☀️', temps: '6/-2', precip: '28%' },
];

const ALERTS = [
  {
    icon: Droplets,
    iconColor: '#ef4444',
    text: 'Moisture stress — root zone drying',
    badge: 'High',
    badgeBg: '#fef2f2',
    badgeColor: '#ef4444',
  },
  {
    icon: Thermometer,
    iconColor: '#f59e0b',
    text: 'Frost risk watch — overnight low −2°C',
    badge: 'Med',
    badgeBg: '#fef3c7',
    badgeColor: '#f59e0b',
  },
];

/* ── SVG Line Chart ── */

interface ChartSeries {
  data: number[];
  color: string;
  label: string;
}

function SvgLineChart({
  dates,
  series,
  height = 150,
  yMin,
  yMax,
  yUnit = '',
}: {
  dates: string[];
  series: ChartSeries[];
  height?: number;
  yMin: number;
  yMax: number;
  yUnit?: string;
}) {
  const width = 356;
  const padLeft = 36;
  const padRight = 8;
  const padTop = 12;
  const padBottom = 28;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const yRange = yMax - yMin || 1;

  function toX(i: number) {
    return padLeft + (i / (dates.length - 1)) * plotW;
  }
  function toY(v: number) {
    return padTop + plotH - ((v - yMin) / yRange) * plotH;
  }

  const yTicks = Array.from({ length: 5 }, (_, i) => yMin + (yRange * i) / 4);

  return (
    <div className="rt__chart-area">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="rt__chart-svg"
      >
        {yTicks.map((tick) => (
          <line
            key={tick}
            x1={padLeft}
            y1={toY(tick)}
            x2={width - padRight}
            y2={toY(tick)}
            stroke="#ebebeb"
            strokeWidth={1}
          />
        ))}
        {yTicks.map((tick) => (
          <text
            key={`label-${tick}`}
            x={padLeft - 6}
            y={toY(tick) + 3}
            textAnchor="end"
            className="rt__chart-axis-label"
          >
            {yUnit === '%' ? `${tick}%` : tick.toFixed(1)}
          </text>
        ))}
        {dates.map((d, i) => (
          <text
            key={d}
            x={toX(i)}
            y={height - 4}
            textAnchor="middle"
            className="rt__chart-axis-label"
          >
            {d}
          </text>
        ))}
        {series.map((s) => {
          const points = s.data.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
          return (
            <polyline
              key={s.label}
              points={points}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}
        {series.map((s) =>
          s.data.map((v, i) => (
            <circle
              key={`${s.label}-${i}`}
              cx={toX(i)}
              cy={toY(v)}
              r={2.5}
              fill={s.color}
            />
          )),
        )}
      </svg>
    </div>
  );
}

function ChartLegend({ series }: { series: ChartSeries[] }) {
  return (
    <div className="rt__chart-legend">
      {series.map((s) => (
        <div key={s.label} className="rt__chart-legend-item">
          <span
            className="rt__chart-legend-dot"
            style={{ backgroundColor: s.color }}
          />
          <span className="rt__chart-legend-label">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Main Component ── */

export function ReportTab({
  focusedZoneId,
  onZoneSelect,
}: {
  focusedZoneId?: string | null;
  onZoneSelect?: (zoneId: string | null) => void;
} = {}) {
  const ndviSeries: ChartSeries[] = [
    { data: NDVI_TREND_DATA.fieldAvg, color: '#16a34a', label: 'Field Avg' },
    { data: NDVI_TREND_DATA.zoneNW3, color: '#3b82f6', label: 'Zone NW-3' },
  ];

  const moistureSeries: ChartSeries[] = [
    { data: MOISTURE_DATA.rootZone, color: '#008f4e', label: 'Root Zone' },
    { data: MOISTURE_DATA.surface, color: '#3b82f6', label: 'Surface' },
  ];

  const tempSeries: ChartSeries[] = [
    { data: TEMP_DATA.surface, color: '#ef4444', label: 'Surface' },
    { data: TEMP_DATA.rootZone, color: '#f59e0b', label: 'Root Zone' },
  ];

  return (
    <div className="rt__root">
      {/* ── Title Section ── */}
      <div className="rt__title-section">
        <h2 className="rt__field-name">Quarter SE 25 010 17 W4</h2>
        <p className="rt__subtitle">SE 25-010-17 W4M  ·  Legal Land Description</p>
      </div>

      {/* ── Report Header ── */}
      <div className="rt__rpt-hdr">
        <div className="rt__rpt-left">
          <span className="rt__rpt-tag">Field Report · Updated Mar 27, 2026</span>
          <div className="rt__rpt-status">
            <span className="rt__rpt-dot" />
            <span className="rt__rpt-status-text">Healthy</span>
          </div>
        </div>
        <button type="button" className="rt__pdf-btn">
          <FileDown size={14} color="#ffffff" />
          <span className="rt__pdf-txt">PDF</span>
        </button>
      </div>

      {/* ── Current Readings ── */}
      <div className="rt__card">
        <span className="rt__section-label">CURRENT READINGS</span>
        <div className="rt__readings-grid">
          {/* Column 1 */}
          <div className="rt__readings-col">
            {READINGS.slice(0, 2).map((r) => (
              <div key={r.label} className="rt__reading-tile">
                <div className="rt__reading-top">
                  <r.icon size={12} color={r.iconColor} />
                  <span className="rt__reading-label">{r.label}</span>
                </div>
                <span className="rt__reading-value" style={r.valueColor ? { color: r.valueColor } : undefined}>
                  {r.value}
                </span>
              </div>
            ))}
          </div>
          {/* Column 2 */}
          <div className="rt__readings-col">
            {READINGS.slice(2, 4).map((r) => (
              <div key={r.label} className="rt__reading-tile">
                <div className="rt__reading-top">
                  <r.icon size={12} color={r.iconColor} />
                  <span className="rt__reading-label">{r.label}</span>
                </div>
                <span className="rt__reading-value" style={r.valueColor ? { color: r.valueColor } : undefined}>
                  {r.value}
                </span>
              </div>
            ))}
          </div>
          {/* Column 3 */}
          <div className="rt__readings-col">
            {READINGS.slice(4, 6).map((r) => (
              <div key={r.label} className="rt__reading-tile">
                <div className="rt__reading-top">
                  <r.icon size={12} color={r.iconColor} />
                  <span className="rt__reading-label">{r.label}</span>
                </div>
                <span className="rt__reading-value" style={r.valueColor ? { color: r.valueColor } : undefined}>
                  {r.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Crop Parameter Assessment ── */}
      <div className="rt__card">
        <div className="rt__crop-hdr">
          <span className="rt__section-label" style={{ marginBottom: 0 }}>CROP PARAMETER ASSESSMENT</span>
          <span className="rt__crop-stage">Flowering</span>
        </div>
        {CROP_PARAMS.map((p) => (
          <div key={p.label} className="rt__param-row">
            <div className="rt__param-top">
              <span className="rt__param-label">{p.label}</span>
              <div className="rt__param-right">
                <span className="rt__param-value">{p.value}</span>
                <CircleCheck size={14} color="#008f4e" />
              </div>
            </div>
            <div className="rt__param-bar-section">
              <div className="rt__param-track">
                <div className="rt__param-fill" style={{ width: `${p.pct}%` }} />
              </div>
              <div className="rt__param-range">
                <span className="rt__param-range-val">12%</span>
                <span className="rt__param-range-val">32%</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Vegetation Index Trend ── */}
      <div className="rt__chart-section">
        <div className="rt__chart-section-inner">
          <div className="rt__chart-header">
            <span className="rt__section-label" style={{ marginBottom: 0 }}>VEGETATION INDEX TREND</span>
            <span className="rt__chart-sub">NDVI + NDRE over time</span>
          </div>
          <SvgLineChart
            dates={NDVI_TREND_DATA.dates}
            series={ndviSeries}
            yMin={0}
            yMax={1}
            height={150}
          />
          <ChartLegend series={ndviSeries} />
        </div>
      </div>

      {/* ── Soil Moisture & Precipitation ── */}
      <div className="rt__chart-section">
        <div className="rt__chart-section-inner">
          <div className="rt__chart-header">
            <span className="rt__section-label" style={{ marginBottom: 0 }}>SOIL MOISTURE & PRECIPITATION</span>
            <span className="rt__chart-sub">30-day history · ERA5-Land</span>
          </div>
          <SvgLineChart
            dates={MOISTURE_DATA.dates}
            series={moistureSeries}
            yMin={0}
            yMax={40}
            yUnit="%"
            height={150}
          />
          <ChartLegend series={moistureSeries} />
        </div>
      </div>

      {/* ── Temperature History ── */}
      <div className="rt__chart-section">
        <div className="rt__chart-section-inner">
          <div className="rt__chart-header">
            <span className="rt__section-label" style={{ marginBottom: 0 }}>TEMPERATURE HISTORY</span>
            <span className="rt__chart-sub">Surface + root zone · 30 days</span>
          </div>
          <SvgLineChart
            dates={TEMP_DATA.dates}
            series={tempSeries}
            yMin={0}
            yMax={20}
            yUnit=""
            height={150}
          />
          <ChartLegend series={tempSeries} />
        </div>
      </div>

      {/* ── 7-Day Forecast ── */}
      <div className="rt__card rt__forecast-section">
        <span className="rt__section-label">7-DAY OUTLOOK</span>
        <div className="rt__forecast-strip">
          {FORECAST.map((f) => (
            <div key={f.day} className="rt__forecast-card">
              <span className="rt__forecast-day">{f.day}</span>
              <Sun size={16} color="#f59e0b" />
              <span className="rt__forecast-temps">{f.temps}</span>
              <span className="rt__forecast-precip">{f.precip}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Alert Summary ── */}
      <div className="rt__card">
        <span className="rt__section-label">ALERT SUMMARY</span>
        {ALERTS.map((a) => (
          <div key={a.text} className="rt__alert-row">
            <a.icon size={14} color={a.iconColor} />
            <span className="rt__alert-text">{a.text}</span>
            <span
              className="rt__alert-badge"
              style={{ background: a.badgeBg, color: a.badgeColor }}
            >
              {a.badge}
            </span>
          </div>
        ))}
      </div>

      {/* ── Moisture Provenance ── */}
      <div className="rt__card rt__provenance">
        <span className="rt__section-label">MOISTURE PROVENANCE</span>
        <p className="rt__provenance-desc">
          Field-level summary from Fresh SAR (2 passes). Confidence: High. Root zone moisture derived from C-band backscatter calibrated to Canola crop profile.
        </p>
        <div className="rt__provenance-chips">
          <span className="rt__provenance-chip">Fresh SAR</span>
          <span className="rt__provenance-chip">ERA5-Land</span>
        </div>
      </div>
    </div>
  );
}
