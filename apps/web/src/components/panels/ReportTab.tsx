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
  type LucideIcon,
} from 'lucide-react';

/* ── Serializable Types (no React.ReactNode) ── */

export type ReadingIconKey =
  | 'temperature'
  | 'soil-temp'
  | 'root-moisture'
  | 'wind'
  | 'ndvi'
  | 'stress-area';

export interface ReportReadingCell {
  iconKey: ReadingIconKey;
  label: string;
  value: string;
  valueColor?: string;
}

export interface ReportCropParam {
  label: string;
  value: string;
  rangeLow: string;
  rangeHigh: string;
  fillPercent: number;
}

export interface ReportChartSection {
  title: string;
  subtitle: string;
}

export interface ReportForecastDay {
  day: string;
  temp: string;
  precip: string;
}

export interface ReportAlertItem {
  iconKey: 'moisture' | 'temperature' | 'leaf' | 'wind' | 'generic';
  text: string;
  severity: 'High' | 'Med' | 'Low';
  trackedZoneIds: readonly string[];
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
  findings: ReportFindingItem[];
  zones: ReportZoneItem[];
  provenanceText: string;
  sources: ReportSourceChip[];
}

/* ── Icon mapping ── */

const READING_ICONS: Record<ReadingIconKey, { Icon: LucideIcon; color: string }> = {
  'temperature': { Icon: Thermometer, color: '#ef4444' },
  'soil-temp': { Icon: Sun, color: '#f59e0b' },
  'root-moisture': { Icon: Droplets, color: '#3b82f6' },
  'wind': { Icon: Wind, color: '#6b7280' },
  'ndvi': { Icon: Leaf, color: '#16a34a' },
  'stress-area': { Icon: TriangleAlert, color: '#f59e0b' },
};

const ALERT_ICONS: Record<ReportAlertItem['iconKey'], LucideIcon> = {
  moisture: Droplets,
  temperature: Thermometer,
  leaf: Leaf,
  wind: Wind,
  generic: TriangleAlert,
};

const ALERT_ICON_COLORS: Record<ReportAlertItem['iconKey'], string> = {
  moisture: '#ef4444',
  temperature: '#f59e0b',
  leaf: '#16a34a',
  wind: '#6b7280',
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
  return (
    <div className="panel__section">
      <span className="panel__section-label">CURRENT READINGS</span>
      <div className="panel__data-grid">
        {[0, 1, 2].map((rowIdx) => (
          <div key={rowIdx} className="panel__data-row">
            {readings.slice(rowIdx * 2, rowIdx * 2 + 2).map((r, i) => {
              const iconInfo = READING_ICONS[r.iconKey];
              return (
                <div key={i} className="panel__data-cell">
                  <div className="panel__data-cell-icon-label">
                    <iconInfo.Icon size={12} color={iconInfo.color} />
                    <span className="panel__data-cell-label">{r.label}</span>
                  </div>
                  <span
                    className="panel__data-cell-value rpt__reading-value"
                    style={r.valueColor ? { color: r.valueColor } : undefined}
                  >
                    {r.value}
                  </span>
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
      {params.map((p, i) => (
        <div key={i} className="progress-row">
          <div className="progress-row__top">
            <span className="progress-row__label">{p.label}</span>
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
      ))}
    </div>
  );
}

function ChartPlaceholder({ chart }: { chart: ReportChartSection }) {
  return (
    <div className="panel__section">
      <div className="panel__section-header">
        <span className="panel__section-label">{chart.title}</span>
        <span className="panel__section-meta">{chart.subtitle}</span>
      </div>
      <div className="rpt__chart-card">
        <div className="rpt__chart-placeholder" />
      </div>
    </div>
  );
}

function ForecastSection({ days }: { days: ReportForecastDay[] }) {
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
  focusedZoneId,
  onZoneSelect,
}: {
  alerts: ReportAlertItem[];
  focusedZoneId?: string | null;
  onZoneSelect?: (zoneId: string | null) => void;
}) {
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
            <span className="rpt__alert-text">{a.text}</span>
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
    return null;
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
    return null;
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
        <ChartPlaceholder key={i} chart={c} />
      ))}

      {/* 7-Day Forecast */}
      <ForecastSection days={field.forecast} />

      {/* Alert Summary */}
      <AlertSummarySection
        alerts={field.alerts}
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
  );
}
