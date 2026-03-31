'use client';

import {
  Bug,
  CheckCircle,
  CircleCheck,
  CircleX,
  Droplets,
  Thermometer,
  TriangleAlert,
} from 'lucide-react';
import { useAppTheme } from '../../../components/layout/WorkspaceShell';

type ThresholdStatus = 'ok' | 'warn' | 'danger';
type CropAlertIconKey = 'temperature' | 'moisture' | 'disease' | 'ok';

export interface CropStageSegment {
  label: string;
  active: boolean;
  color: string;
}

export interface CropThresholdRow {
  param: string;
  min: string;
  optimal: string;
  optimalColor: string;
  max: string;
  actual: string;
  notes: string;
  status: ThresholdStatus;
  borderColor: string;
}

export interface CropSummaryMetric {
  label: string;
  value: string;
  valueColor: string;
}

export interface CropDonutSection {
  value: number;
  label: string;
  subLabel: string;
  fillColor: string;
  metrics: readonly CropSummaryMetric[];
}

export interface CropFieldStatusTile {
  label: string;
  value: string;
  sub: string;
  valueColor: string;
  bg: string;
  border: string;
}

export interface CropDiseaseRiskCard {
  name: string;
  desc: string;
  pct: string;
  color: string;
  bg: string;
  recommendedAction?: string;
}

export interface CropProvenanceRow {
  key: string;
  value: string;
}

export interface CropAlertCard {
  iconKey: CropAlertIconKey;
  iconColor: string;
  bg: string;
  title: string;
  desc: string;
}

export interface FieldCropProps {
  cropName: string;
  lld: string;
  growthSegments: readonly CropStageSegment[];
  accumulatedGddLabel: string;
  gddUnitLabel: string;
  thresholdStageLabel: string;
  thresholds: readonly CropThresholdRow[];
  healthIndexTitle: string;
  healthIndex: CropDonutSection;
  moistureBalanceTitle: string;
  moistureBalance: CropDonutSection;
  fieldTiles: readonly CropFieldStatusTile[];
  diseaseRisks: readonly CropDiseaseRiskCard[];
  provenanceLabel: string;
  provenanceRows: readonly CropProvenanceRow[];
  provenanceChips: readonly string[];
  alerts: readonly CropAlertCard[];
  footer: string;
}

/* ── Dark mode color adapters ── */

const DARK_COLOR_MAP: Record<string, string> = {
  '#16a34a': 'rgba(74, 222, 128, 0.85)',
  '#4ade80': 'rgba(74, 222, 128, 0.65)',
  '#ef4444': 'rgba(252, 165, 165, 0.85)',
  '#f59e0b': 'rgba(252, 211, 77, 0.85)',
  '#dc2626': 'rgba(252, 165, 165, 0.85)',
  '#d97706': 'rgba(252, 211, 77, 0.85)',
  '#3b82f6': 'rgba(147, 197, 253, 0.85)',
  '#6b7280': 'rgba(255, 255, 255, 0.45)',
  '#64748b': 'rgba(255, 255, 255, 0.45)',
  '#166534': 'rgba(74, 222, 128, 0.7)',
  '#eab308': 'rgba(252, 211, 77, 0.7)',
};

const DARK_BG_MAP: Record<string, string> = {
  '#fef2f2': 'rgba(239, 68, 68, 0.08)',
  '#fef3c7': 'rgba(245, 158, 11, 0.08)',
  '#fffbeb': 'rgba(245, 158, 11, 0.08)',
  '#fefce8': 'rgba(245, 158, 11, 0.08)',
  '#f0fdf4': 'rgba(74, 222, 128, 0.08)',
  '#dcfce7': 'rgba(74, 222, 128, 0.08)',
  '#eff6ff': 'rgba(59, 130, 246, 0.08)',
  '#dbeafe': 'rgba(59, 130, 246, 0.08)',
};

const DARK_BORDER_MAP: Record<string, string> = {
  '#fecaca': 'rgba(239, 68, 68, 0.18)',
  '#fde68a': 'rgba(245, 158, 11, 0.18)',
  '#bbf7d0': 'rgba(74, 222, 128, 0.18)',
  '#bfdbfe': 'rgba(59, 130, 246, 0.18)',
};

function adaptColor(color: string, isDark: boolean): string {
  if (!isDark) return color;
  return DARK_COLOR_MAP[color.toLowerCase()] ?? color;
}

function adaptBg(bg: string, isDark: boolean): string {
  if (!isDark) return bg;
  return DARK_BG_MAP[bg.toLowerCase()] ?? bg;
}

function adaptBorder(border: string, isDark: boolean): string {
  if (!isDark) return border;
  return DARK_BORDER_MAP[border.toLowerCase()] ?? border;
}

function StatusIcon({ status, isDark }: { status: ThresholdStatus; isDark: boolean }) {
  if (status === 'ok') return <CircleCheck size={14} color={isDark ? 'rgba(74, 222, 128, 0.85)' : '#16a34a'} />;
  if (status === 'warn') return <TriangleAlert size={14} color={isDark ? 'rgba(252, 211, 77, 0.85)' : '#f59e0b'} />;
  return <CircleX size={14} color={isDark ? 'rgba(252, 165, 165, 0.85)' : '#ef4444'} />;
}

function CropDonut({
  value,
  label,
  subLabel,
  fillColor,
  isDark,
}: {
  value: number;
  label: string;
  subLabel: string;
  fillColor: string;
  isDark: boolean;
}) {
  const size = 150;
  const strokeWidth = 5.684;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(value, 1)));

  return (
    <svg width={size} height={size} className="ct__donut-svg">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={isDark ? 'rgba(255, 255, 255, 0.1)' : '#ebebeb'}
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

function MetricTile({
  label,
  value,
  valueColor,
}: CropSummaryMetric) {
  return (
    <div className="ct__metric-tile">
      <span className="ct__metric-tile-label">{label}</span>
      <span className="ct__metric-tile-value" style={{ color: valueColor }}>
        {value}
      </span>
    </div>
  );
}

function alertIcon(iconKey: CropAlertIconKey) {
  switch (iconKey) {
    case 'temperature':
      return Thermometer;
    case 'moisture':
      return Droplets;
    case 'disease':
      return Bug;
    case 'ok':
      return CheckCircle;
  }
}

export function CropTab({ field }: { field: FieldCropProps }) {
  const theme = useAppTheme();
  const isDark = theme === 'dark';

  return (
    <div className="ct__container">
      <div className="ct__title-section">
        <h2 className="ct__crop-name">{field.cropName}</h2>
        <span className="ct__subtitle">
          {field.lld} &nbsp;&middot;&nbsp; Legal Land Description
        </span>
      </div>

      <section className="ct__card">
        <span className="ct__section-label">GROWTH STAGE</span>
        <div className="ct__growth-bar">
          {field.growthSegments.map((segment, index) => (
            <div
              key={segment.label}
              className="ct__growth-segment"
              style={{
                background: adaptColor(segment.color, isDark),
                borderRadius:
                  index === 0
                    ? '4px 0 0 4px'
                    : index === field.growthSegments.length - 1
                      ? '0 4px 4px 0'
                      : undefined,
              }}
            />
          ))}
        </div>
        <div className="ct__stage-labels">
          {field.growthSegments.map((segment) => (
            <span
              key={segment.label}
              className="ct__stage-label"
              style={{
                fontWeight: segment.active ? 700 : 400,
                color: segment.active
                  ? (isDark ? 'rgba(74, 222, 128, 0.85)' : '#16a34a')
                  : (isDark ? 'rgba(255, 255, 255, 0.4)' : '#8a8f98'),
              }}
            >
              {segment.label}
            </span>
          ))}
        </div>
        <div className="ct__gdd-val">
          <span className="ct__gdd-number">{field.accumulatedGddLabel}</span>
          <span className="ct__gdd-unit">{field.gddUnitLabel}</span>
        </div>
      </section>

      <section className="ct__card ct__card--no-pad">
        <div className="ct__thresh-hdr">
          <span className="ct__section-label">CROP THRESHOLDS</span>
          <span className="ct__thresh-stage">{field.thresholdStageLabel}</span>
        </div>
        <div className="ct__col-hdr">
          <span className="ct__col-hdr-cell ct__col-hdr-cell--param">Parameter</span>
          <span className="ct__col-hdr-cell ct__col-hdr-cell--num">Min</span>
          <span className="ct__col-hdr-cell ct__col-hdr-cell--num">Optimal</span>
          <span className="ct__col-hdr-cell ct__col-hdr-cell--num">Max</span>
          <span className="ct__col-hdr-cell ct__col-hdr-cell--status">Status</span>
        </div>
        {field.thresholds.map((row, index) => (
          <div
            key={row.param}
            className="ct__thresh-row"
            style={{
              borderLeft: `3px solid ${row.borderColor}`,
              borderRadius:
                index === field.thresholds.length - 1 ? '0 0 10px 10px' : undefined,
            }}
          >
            <span className="ct__thresh-param">{row.param}</span>
            <span className="ct__thresh-num">{row.min}</span>
            <span className="ct__thresh-num" style={{ color: adaptColor(row.optimalColor, isDark) }}>
              {row.optimal}
            </span>
            <span className="ct__thresh-num">{row.max}</span>
            <span className="ct__thresh-status">
              <StatusIcon status={row.status} isDark={isDark} />
            </span>
          </div>
        ))}
      </section>

      <section className="ct__card">
        <span className="ct__section-label">{field.healthIndexTitle}</span>
        <div className="ct__donut-wrapper">
          <CropDonut
            value={field.healthIndex.value}
            label={field.healthIndex.label}
            subLabel={field.healthIndex.subLabel}
            fillColor={adaptColor(field.healthIndex.fillColor, isDark)}
            isDark={isDark}
          />
          <div className="ct__metric-tiles">
            {field.healthIndex.metrics.map((metric) => (
              <MetricTile
                key={metric.label}
                label={metric.label}
                value={metric.value}
                valueColor={adaptColor(metric.valueColor, isDark)}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="ct__card">
        <span className="ct__section-label">{field.moistureBalanceTitle}</span>
        <div className="ct__donut-wrapper">
          <CropDonut
            value={field.moistureBalance.value}
            label={field.moistureBalance.label}
            subLabel={field.moistureBalance.subLabel}
            fillColor={adaptColor(field.moistureBalance.fillColor, isDark)}
            isDark={isDark}
          />
          <div className="ct__metric-tiles">
            {field.moistureBalance.metrics.map((metric) => (
              <MetricTile
                key={metric.label}
                label={metric.label}
                value={metric.value}
                valueColor={adaptColor(metric.valueColor, isDark)}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="ct__card">
        <span className="ct__section-label">FIELD STATUS INDICATORS</span>
        <div className="ct__fs-grid">
          <div className="ct__fs-row">
            {field.fieldTiles.slice(0, 2).map((tile) => (
              <div
                key={tile.label}
                className="ct__fs-tile"
                style={{ background: adaptBg(tile.bg, isDark), borderColor: adaptBorder(tile.border, isDark) }}
              >
                <span className="ct__fs-tile-label">{tile.label}</span>
                <span className="ct__fs-tile-value" style={{ color: adaptColor(tile.valueColor, isDark) }}>
                  {tile.value}
                </span>
                <span className="ct__fs-tile-sub">{tile.sub}</span>
              </div>
            ))}
          </div>
          <div className="ct__fs-row">
            {field.fieldTiles.slice(2, 4).map((tile) => (
              <div
                key={tile.label}
                className="ct__fs-tile"
                style={{ background: adaptBg(tile.bg, isDark), borderColor: adaptBorder(tile.border, isDark) }}
              >
                <span className="ct__fs-tile-label">{tile.label}</span>
                <span className="ct__fs-tile-value" style={{ color: adaptColor(tile.valueColor, isDark) }}>
                  {tile.value}
                </span>
                <span className="ct__fs-tile-sub">{tile.sub}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="ct__card">
        <span className="ct__section-label">DISEASE MODEL RISK</span>
        {field.diseaseRisks.map((risk) => (
          <div
            key={`${risk.name}-${risk.pct}`}
            className="ct__dis-card"
            style={{ background: adaptBg(risk.bg, isDark) }}
          >
            <Bug size={18} color={adaptColor(risk.color, isDark)} />
            <div className="ct__dis-body">
              <span className="ct__dis-title">{risk.name}</span>
              <span className="ct__dis-desc" style={{ color: adaptColor(risk.color, isDark) }}>
                {risk.desc}
              </span>
            </div>
            <span className="ct__dis-pct" style={{ color: adaptColor(risk.color, isDark) }}>
              {risk.pct}
            </span>
          </div>
        ))}
      </section>

      <section className="ct__card">
        <span className="ct__section-label">{field.provenanceLabel}</span>
        {field.provenanceRows.map((row) => (
          <div key={row.key} className="ct__sar-row">
            <span className="ct__sar-key">{row.key}</span>
            <span className="ct__sar-val">{row.value}</span>
          </div>
        ))}
        <div className="ct__sar-chips">
          {field.provenanceChips.map((chip) => (
            <span key={chip} className="ct__sar-chip ct__sar-chip--blue">
              {chip}
            </span>
          ))}
        </div>
      </section>

      <section className="ct__card">
        <span className="ct__section-label">ACTIVE CROP ALERTS</span>
        {field.alerts.map((alert) => {
          const Icon = alertIcon(alert.iconKey);
          return (
            <div
              key={`${alert.title}-${alert.desc}`}
              className="ct__alert-row"
              style={{ background: adaptBg(alert.bg, isDark) }}
            >
              <Icon size={14} color={adaptColor(alert.iconColor, isDark)} />
              <div className="ct__alert-body">
                <span className="ct__alert-title">{alert.title}</span>
                <span className="ct__alert-desc">{alert.desc}</span>
              </div>
            </div>
          );
        })}
      </section>

      <div className="ct__footer">{field.footer}</div>
    </div>
  );
}
