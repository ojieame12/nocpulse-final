'use client';

import {
  Droplets,
  Thermometer,
  Sun,
  Wind,
  Leaf,
  TriangleAlert,
  CircleCheck,
  FileDown,
  Snowflake,
  CloudDrizzle,
  CloudHail,
  Gauge,
  type LucideIcon,
} from 'lucide-react';
import { MetricHintProvider } from '../ui/MetricHintProvider';
import { ValueSlot } from '../ui/ValueSlot';

/* ── Serializable Types (no React.ReactNode) ── */

export type ReadingIconKey =
  | 'temperature'
  | 'soil-moisture'
  | 'root-moisture'
  | 'wind'
  | 'ndvi'
  | 'ndre'
  | 'ndmi'
  | 'radar-wetness'
  | 'stress-area';

export interface ReportReadingCell {
  iconKey: ReadingIconKey;
  label: string;
  value: string;
  valueColor?: string;
  /** Tiny provenance hint shown beneath the value — e.g. "SAR", "Optical", "Weather". */
  sourceTag?: string;
}

export interface ReportCropParam {
  label: string;
  value: string;
  rangeLow: string;
  rangeHigh: string;
  fillPercent: number;
}

export type ReportChartValueFormat =
  | 'percent'
  | 'index'
  | 'temperature'
  | 'millimetres';

export interface ReportChartPoint {
  label: string;
  value: number | null;
}

export interface ReportChartSeries {
  label: string;
  color: string;
  format: ReportChartValueFormat;
  points: ReportChartPoint[];
}

export interface ReportChartSection {
  title: string;
  subtitle: string;
  series: ReportChartSeries[];
  emptyText?: string;
}

export interface ReportForecastDay {
  day: string;
  temp: string;
  precip: string;
}

export interface ReportAlertItem {
  iconKey: 'moisture' | 'temperature' | 'leaf' | 'wind' | 'hail' | 'generic';
  text: string;
  severity: 'High' | 'Med' | 'Low';
  trackedZoneIds: readonly string[];
  /** Optional secondary detail line (e.g. hail size, event window). */
  detail?: string | null;
}

export interface ReportSourceChip {
  label: string;
}

export interface ReportFindingItem {
  id: string;
  title: string;
  summary: string | null;
  severity: 'High' | 'Med' | 'Low';
  trackedZoneIds: readonly string[];
}

export interface ReportZoneItem {
  id: string;
  family: string;
  trackingKey: string;
  status: string;
  severity: 'High' | 'Med' | 'Low' | null;
  affectedCellCount: number;
  lastSeenAt: string;
}

export interface FieldReportProps {
  name: string;
  lld: string;
  updatedDate: string;
  healthStatus: string;
  readings: ReportReadingCell[];
  cropStage: string;
  cropParams: ReportCropParam[];
  charts: ReportChartSection[];
  forecast: ReportForecastDay[];
  alerts: ReportAlertItem[];
  alertsEmptyStateTitle?: string;
  alertsEmptyStateDescription?: string;
  findings: ReportFindingItem[];
  zones: ReportZoneItem[];
  provenanceText: string;
  sources: ReportSourceChip[];
}

/* ── Icon mapping ── */

const READING_ICONS: Record<ReadingIconKey, { Icon: LucideIcon; color: string }> = {
  'temperature': { Icon: Thermometer, color: '#ef4444' },
  'soil-moisture': { Icon: Droplets, color: '#0ea5e9' },
  'root-moisture': { Icon: Droplets, color: '#3b82f6' },
  'wind': { Icon: Wind, color: '#6b7280' },
  'ndvi': { Icon: Leaf, color: '#16a34a' },
  'ndre': { Icon: Leaf, color: '#14b8a6' },
  'ndmi': { Icon: Droplets, color: '#0ea5e9' },
  'radar-wetness': { Icon: Droplets, color: '#06b6d4' },
  'stress-area': { Icon: TriangleAlert, color: '#f59e0b' },
};

const CROP_PARAM_ICONS: Record<string, { Icon: LucideIcon; color: string }> = {
  "root moisture":     { Icon: Droplets,     color: "#3b82f6" },
  "soil moisture":     { Icon: Droplets,     color: "#3b82f6" },
  "surface moisture":  { Icon: Droplets,     color: "#0ea5e9" },
  "surface wetness":   { Icon: Droplets,     color: "#0ea5e9" },
  "frost min":         { Icon: Snowflake,    color: "#818cf8" },
  "water balance 72h": { Icon: CloudDrizzle, color: "#06b6d4" },
  "water balance":     { Icon: CloudDrizzle, color: "#06b6d4" },
  "ndvi":              { Icon: Leaf,         color: "#16a34a" },
  "temperature":       { Icon: Thermometer,  color: "#ef4444" },
  "wind":              { Icon: Wind,         color: "#6b7280" },
};

const ALERT_ICONS: Record<ReportAlertItem['iconKey'], LucideIcon> = {
  moisture: Droplets,
  temperature: Thermometer,
  leaf: Leaf,
  wind: Wind,
  hail: CloudHail,
  generic: TriangleAlert,
};

const ALERT_ICON_COLORS: Record<ReportAlertItem['iconKey'], string> = {
  moisture: '#ef4444',
  temperature: '#f59e0b',
  leaf: '#16a34a',
  wind: '#6b7280',
  hail: '#818cf8',
  generic: '#f59e0b',
};

/* ── Sub-components ── */

function ReportHeader({ field }: { field: FieldReportProps }) {
  return (
    <div className="rpt__header">
      <div className="rpt__header-left">
        <span className="rpt__header-tag">
          Field Report &middot; Updated {field.updatedDate}
        </span>
        <span className="rpt__header-status">
          <span className="rpt__header-status-dot" />
          <span className="rpt__header-status-text">{field.healthStatus}</span>
        </span>
      </div>
      <button className="rpt__pdf-btn">
        <FileDown size={14} />
        <span>PDF</span>
      </button>
    </div>
  );
}

function ReadingsSection({ readings }: { readings: ReportReadingCell[] }) {
  const rowCount = Math.ceil(readings.length / 2);
  return (
    <div className="panel__section">
      <span className="panel__section-label">CURRENT READINGS</span>
      <div className="panel__data-grid">
        {Array.from({ length: rowCount }, (_, rowIdx) => (
          <div key={rowIdx} className="panel__data-row">
            {readings.slice(rowIdx * 2, rowIdx * 2 + 2).map((r, i) => {
              const iconInfo = READING_ICONS[r.iconKey];
              return (
                <div
                  key={i}
                  className="panel__data-cell"
                  data-metric-hint={r.iconKey}
                  data-metric-value={r.value}
                >
                  <div className="panel__data-cell-icon-label">
                    <iconInfo.Icon size={12} color={iconInfo.color} />
                    <span className="panel__data-cell-label">{r.label}</span>
                  </div>
                  <ValueSlot
                    className="panel__data-cell-value rpt__reading-value"
                    style={r.valueColor ? { color: r.valueColor } : undefined}
                  >
                    {r.value}
                  </ValueSlot>
                  {r.sourceTag ? (
                    <span className="panel__data-cell-source">{r.sourceTag}</span>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function CropAssessmentSection({
  params,
  stage,
}: {
  params: ReportCropParam[];
  stage: string;
}) {
  return (
    <div className="panel__section">
      <div className="panel__section-header">
        <span className="panel__section-label">CROP PARAMETER ASSESSMENT</span>
        <span className="rpt__crop-stage">{stage}</span>
      </div>
      {params.map((p, i) => {
        const paramIcon = CROP_PARAM_ICONS[p.label.toLowerCase()] ?? { Icon: Gauge, color: "var(--text-muted)" };
        return (
        <div key={i} className="progress-row" data-metric-hint={p.label.toLowerCase()} data-metric-value={p.value}>
          <div className="progress-row__top">
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <paramIcon.Icon size={13} color={paramIcon.color} strokeWidth={2} />
              <span className="progress-row__label">{p.label}</span>
            </div>
            <div className="progress-row__right">
              <span className="progress-row__value">{p.value}</span>
              <CircleCheck size={14} color="#008f4e" />
            </div>
          </div>
          <div className="progress-row__bar-container">
            <div
              className="progress-row__bar-fill"
              style={{ width: `${p.fillPercent}%` }}
            />
          </div>
          <div className="progress-row__range">
            <span className="progress-row__range-val">{p.rangeLow}</span>
            <span className="progress-row__range-val">{p.rangeHigh}</span>
          </div>
        </div>
        );
      })}
    </div>
  );
}

function formatChartValue(
  value: number | null | undefined,
  format: ReportChartValueFormat,
) {
  if (value == null || !Number.isFinite(value)) {
    return '—';
  }

  switch (format) {
    case 'percent':
      return `${value.toFixed(1)}%`;
    case 'index':
      return value.toFixed(2);
    case 'temperature':
      return `${value.toFixed(1)}°C`;
    case 'millimetres':
      return `${value.toFixed(1)} mm`;
  }
}

function findLatestChartValue(series: ReportChartSeries) {
  for (let index = series.points.length - 1; index >= 0; index -= 1) {
    const value = series.points[index]?.value;
    if (value != null && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

function buildChartPolyline(
  points: ReportChartPoint[],
  min: number,
  max: number,
  width: number,
  height: number,
) {
  const valueRange = max - min || 1;
  const step = points.length > 1 ? width / (points.length - 1) : width;

  return points
    .map((point, index) => {
      const numericValue = point.value;
      if (numericValue == null || !Number.isFinite(numericValue)) {
        return null;
      }

      const x = points.length > 1 ? index * step : width / 2;
      const y = height - 8 - ((numericValue - min) / valueRange) * (height - 16);
      return `${x},${y}`;
    })
    .filter((entry): entry is string => entry != null)
    .join(' ');
}

function ReportChart({
  chart,
}: {
  chart: ReportChartSection;
}) {
  const numericValues = chart.series.flatMap((series) =>
    series.points
      .map((point) => point.value)
      .filter((value): value is number => value != null && Number.isFinite(value)),
  );
  const hasData = numericValues.length > 0;
  const chartWidth = 240;
  const chartHeight = 168;
  const chartMin = hasData ? Math.min(...numericValues) : 0;
  const chartMax = hasData ? Math.max(...numericValues) : 1;
  const labelSource =
    chart.series.find((series) => series.points.length > 0)?.points ?? [];
  const firstLabel = labelSource[0]?.label ?? 'Start';
  const lastLabel = labelSource.at(-1)?.label ?? 'Latest';

  return (
    <div className="panel__section">
      <div className="panel__section-header">
        <span className="panel__section-label">{chart.title}</span>
        <span className="panel__section-meta">{chart.subtitle}</span>
      </div>
      <div className="rpt__chart-card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            marginBottom: 12,
          }}
        >
          {chart.series.map((series) => (
            <div
              key={series.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                minWidth: 0,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: series.color,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--color-slate-700)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {series.label}
              </span>
              <span
                className="fdp-mono"
                style={{
                  fontSize: 11,
                  color: 'var(--color-slate-900)',
                  fontWeight: 700,
                }}
              >
                {formatChartValue(findLatestChartValue(series), series.format)}
              </span>
            </div>
          ))}
        </div>
        {hasData ? (
          <>
            <svg
              width="100%"
              height={chartHeight}
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              preserveAspectRatio="none"
              style={{ display: 'block' }}
            >
              {[0.2, 0.5, 0.8].map((fraction) => {
                const y = chartHeight - fraction * (chartHeight - 16) - 8;
                return (
                  <line
                    key={fraction}
                    x1={0}
                    y1={y}
                    x2={chartWidth}
                    y2={y}
                    stroke="rgba(148,163,184,0.18)"
                    strokeWidth={1}
                  />
                );
              })}
              {chart.series.map((series, index) => {
                const polyline = buildChartPolyline(
                  series.points,
                  chartMin,
                  chartMax,
                  chartWidth,
                  chartHeight,
                );
                if (!polyline) {
                  return null;
                }

                return (
                  <g key={series.label}>
                    {index === 0 ? (
                      <polygon
                        points={`0,${chartHeight} ${polyline} ${chartWidth},${chartHeight}`}
                        fill={series.color}
                        opacity={0.08}
                      />
                    ) : null}
                    <polyline
                      points={polyline}
                      fill="none"
                      stroke={series.color}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={0.88}
                    />
                  </g>
                );
              })}
            </svg>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 10,
              }}
            >
              <span className="panel__section-meta">{firstLabel}</span>
              <span className="panel__section-meta">{lastLabel}</span>
            </div>
          </>
        ) : (
          <div className="rpt__chart-placeholder">
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 11,
                color: 'var(--color-slate-500)',
              }}
            >
              {chart.emptyText ?? 'No chart history available yet.'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function ForecastSection({ days }: { days: ReportForecastDay[] }) {
  if (days.length === 0) {
    return (
      <div className="panel__section">
        <span className="panel__section-label">7-DAY FORECAST</span>
        <div className="rpt__chart-placeholder">
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 11,
              color: 'var(--color-slate-500)',
            }}
          >
            No forecast days have been stored for this field yet.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="panel__section">
      <span className="panel__section-label">7-DAY FORECAST</span>
      <div className="outlook-grid">
        {days.map((d) => (
          <div key={d.day} className="outlook-card">
            <span className="outlook-card__day">{d.day}</span>
            <Sun size={16} className="outlook-card__icon" />
            <span className="outlook-card__temps">{d.temp}</span>
            <span className="outlook-card__precip">{d.precip}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AlertSummarySection({
  alerts,
  emptyStateTitle,
  emptyStateDescription,
  focusedZoneId,
  onZoneSelect,
}: {
  alerts: ReportAlertItem[];
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  focusedZoneId?: string | null;
  onZoneSelect?: (zoneId: string | null) => void;
}) {
  if (alerts.length === 0) {
    return (
      <div className="panel__section">
        <span className="panel__section-label">ALERT SUMMARY</span>
        <div className="rpt__chart-placeholder">
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 11,
              color: 'var(--color-slate-500)',
            }}
          >
            {emptyStateDescription ??
              (emptyStateTitle ??
                'No active alerts are currently linked to this field.')}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="panel__section">
      <span className="panel__section-label">ALERT SUMMARY</span>
      {alerts.map((a, i) => {
        const AlertIcon = ALERT_ICONS[a.iconKey];
        const iconColor = ALERT_ICON_COLORS[a.iconKey];
        return (
          <button
            key={i}
            type="button"
            className={`alert-card rpt__alert-card alerts-card--interactive${
              focusedZoneId && a.trackedZoneIds.includes(focusedZoneId)
                ? ' alerts-card--focused'
                : ''
            }`}
            onClick={() =>
              onZoneSelect?.(
                focusedZoneId && a.trackedZoneIds.includes(focusedZoneId)
                  ? null
                  : a.trackedZoneIds[0] ?? null,
              )
            }
          >
            <span className="alert-card__icon" style={{ color: iconColor }}>
              <AlertIcon size={14} />
            </span>
            <span className="rpt__alert-text-group">
              <span className="rpt__alert-text">{a.text}</span>
              {a.detail ? (
                <span className="rpt__alert-detail">{a.detail}</span>
              ) : null}
            </span>
            <span
              className={`alert-card__badge alert-card__badge--${
                a.severity === 'High' ? 'danger' : 'warning'
              }`}
            >
              {a.severity}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function FindingSummarySection({
  findings,
  focusedZoneId,
  onZoneSelect,
}: {
  findings: ReportFindingItem[];
  focusedZoneId?: string | null;
  onZoneSelect?: (zoneId: string | null) => void;
}) {
  if (findings.length === 0) {
    return (
      <div className="panel__section">
        <span className="panel__section-label">ACTIVE FINDINGS</span>
        <div className="rpt__chart-placeholder">
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 11,
              color: 'var(--color-slate-500)',
            }}
          >
            No active findings currently reference this field.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="panel__section">
      <span className="panel__section-label">ACTIVE FINDINGS</span>
      {findings.map((finding) => (
        <button
          key={finding.id}
          type="button"
          className={`alerts-card rpt__alert-card alerts-card--interactive${
            focusedZoneId && finding.trackedZoneIds.includes(focusedZoneId)
              ? ' alerts-card--focused'
              : ''
          }`}
          onClick={() =>
            onZoneSelect?.(
              focusedZoneId && finding.trackedZoneIds.includes(focusedZoneId)
                ? null
                : finding.trackedZoneIds[0] ?? null,
            )
          }
        >
          <span className="rpt__alert-text">
            {finding.summary ?? finding.title}
          </span>
          <span
            className={`alert-card__badge alert-card__badge--${
              finding.severity === 'High' ? 'danger' : 'warning'
            }`}
          >
            {finding.severity}
          </span>
        </button>
      ))}
    </div>
  );
}

function ZoneSummarySection({
  zones,
  focusedZoneId,
  onZoneSelect,
}: {
  zones: ReportZoneItem[];
  focusedZoneId?: string | null;
  onZoneSelect?: (zoneId: string | null) => void;
}) {
  if (zones.length === 0) {
    return (
      <div className="panel__section">
        <span className="panel__section-label">TRACKED ZONES</span>
        <div className="rpt__chart-placeholder">
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 11,
              color: 'var(--color-slate-500)',
            }}
          >
            No tracked zones are active for this field right now.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="panel__section">
      <span className="panel__section-label">TRACKED ZONES</span>
      {zones.map((zone) => (
        <button
          key={zone.id}
          type="button"
          className={`alerts-card rpt__alert-card alerts-card--interactive${
            focusedZoneId === zone.id ? ' alerts-card--focused' : ''
          }`}
          onClick={() =>
            onZoneSelect?.(focusedZoneId === zone.id ? null : zone.id)
          }
        >
          <span className="rpt__alert-text">
            {zone.family.replace(/_/g, ' ')} · {zone.trackingKey} · {zone.affectedCellCount} cells
          </span>
          <span
            className={`alert-card__badge alert-card__badge--${
              zone.severity === 'High' ? 'danger' : 'warning'
            }`}
          >
            {zone.status}
          </span>
        </button>
      ))}
    </div>
  );
}

function ProvenanceSection({
  text,
  sources,
}: {
  text: string;
  sources: ReportSourceChip[];
}) {
  return (
    <div className="panel__section">
      <span className="panel__section-label">MOISTURE PROVENANCE</span>
      <p className="rpt__provenance-text">{text}</p>
      <div className="rpt__provenance-chips">
        {sources.map((s) => (
          <span key={s.label} className="rpt__provenance-chip">
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Main Component ── */

export function ReportTab({
  field,
  focusedZoneId,
  onZoneSelect,
}: {
  field: FieldReportProps;
  focusedZoneId?: string | null;
  onZoneSelect?: (zoneId: string | null) => void;
}) {
  return (
    <MetricHintProvider>
    <div className="panel__body">
      {/* Title */}
      <div className="panel__title-section">
        <h2 className="panel__title-main">{field.name}</h2>
        <span className="panel__title-sub">
          {field.lld} &middot; Legal Land Description
        </span>
      </div>

      {/* Report Header */}
      <ReportHeader field={field} />

      {/* Current Readings - 2x3 grid */}
      <ReadingsSection readings={field.readings} />

      {/* Crop Parameter Assessment */}
      <CropAssessmentSection params={field.cropParams} stage={field.cropStage} />

      {/* Chart Sections */}
      {field.charts.map((c, i) => (
        <ReportChart key={i} chart={c} />
      ))}

      {/* 7-Day Forecast */}
      <ForecastSection days={field.forecast} />

      {/* Alert Summary */}
      <AlertSummarySection
        alerts={field.alerts}
        emptyStateTitle={field.alertsEmptyStateTitle}
        emptyStateDescription={field.alertsEmptyStateDescription}
        focusedZoneId={focusedZoneId}
        onZoneSelect={onZoneSelect}
      />

      <FindingSummarySection
        findings={field.findings}
        focusedZoneId={focusedZoneId}
        onZoneSelect={onZoneSelect}
      />

      <ZoneSummarySection
        zones={field.zones}
        focusedZoneId={focusedZoneId}
        onZoneSelect={onZoneSelect}
      />

      {/* Moisture Provenance */}
      <ProvenanceSection text={field.provenanceText} sources={field.sources} />
    </div>
    </MetricHintProvider>
  );
}
