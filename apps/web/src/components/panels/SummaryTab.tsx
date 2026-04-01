'use client';

import { useState } from 'react';
import {
  Cloud,
  Droplets,
  Thermometer,
  TrendingDown,
  RefreshCw,
  FileText,
  Sun,
  CheckCircle,
  ArrowLeftRight,
  Flame,
  Leaf,
  Waves,
  BarChart3,
  ShieldCheck,
} from 'lucide-react';
import { DonutChart, SectionHeader } from '../ui';
import { Button } from '../ui/Button';
import { MetricHintProvider } from '../ui/MetricHintProvider';
import { ValueSlot } from '../ui/ValueSlot';

/* ── Types ── */

export interface SummaryAlert {
  label: string;
  desc: string;
  severity: 'warning' | 'danger';
}

export interface SummaryOutlookDay {
  day: string;
  high: number;
  low: number;
  precip: string;
}

/** Semantic moisture confidence tier for UI styling. */
export type MoistureConfidenceLevel = 'high' | 'medium' | 'low' | 'unknown';

export interface FieldSummaryProps {
  name: string;
  lld: string;
  crop: string;
  cropStage: string;
  contextLabel?: string;
  conditionsMeta?: string;
  updatedLabel?: string;
  moisture: number;
  cloudCover: string;
  surfaceMoisture: string;
  fieldState: string;
  fieldStateColor: string;
  rootMoisture: string;
  rootMoistureSub: string;
  trend: string;
  trendSub: string;
  spread: string;
  spreadSub: string;
  confidence: string;
  confidenceSub: string;
  /** Semantic confidence tier for ring indicator. */
  moistureConfidenceLevel: MoistureConfidenceLevel;
  /** How moisture was derived: source-backed, seeded-range, or unknown. */
  moistureDerivationMode: string;
  /** Extended source tag with freshness, e.g. "Satellite-derived · SAR 18h ago" */
  sourceTagExtended?: string;
  precipitation: string;
  precipitationSub: string;
  nextRain: string;
  nextRainSub: string;
  rainChance: string;
  rainChanceSub: string;
  sevenDayTotal: string;
  sevenDayTotalSub: string;
  alerts: SummaryAlert[];
  outlook: SummaryOutlookDay[];
}

/* ── Layer Pills ── */

const LAYERS = ['NDVI', 'NDRE', 'NDMI'] as const;
const EXTRA = ['Moisture'] as const;
type Layer = (typeof LAYERS)[number] | (typeof EXTRA)[number];

function LayerPills({ active, onChange }: { active: Layer; onChange: (l: Layer) => void }) {
  return (
    <div className="layer-pills">
      {LAYERS.map((l) => (
        <button
          key={l}
          type="button"
          className={`layer-pill${active === l ? ' layer-pill--active' : ''}`}
          onClick={() => onChange(l)}
        >
          {l}
        </button>
      ))}
      <div className="layer-pills__divider" />
      {EXTRA.map((l) => (
        <button
          key={l}
          type="button"
          className={`layer-pill${active === l ? ' layer-pill--active' : ''}`}
          onClick={() => onChange(l)}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

/* ── Component ── */

/* ── Confidence styling map ── */
const CONFIDENCE_RING: Record<MoistureConfidenceLevel, { color: string; label: string }> = {
  high:    { color: 'var(--status-positive, #16a34a)', label: 'High confidence' },
  medium:  { color: 'var(--status-warning, #f59e0b)',  label: 'Moderate confidence' },
  low:     { color: 'var(--status-danger, #ef4444)',   label: 'Low confidence' },
  unknown: { color: 'var(--text-muted, #8a8f98)',      label: 'Unassessed' },
};

export function SummaryTab({ field }: { field: FieldSummaryProps }) {
  const [activeLayer, setActiveLayer] = useState<Layer>('NDVI');
  const moistureColor = field.moisture < 0.3 ? '#ef4444' : '#16a34a';
  const contextLabel = field.contextLabel ?? 'Field overview';
  const conditionsMeta = field.conditionsMeta ?? 'Field average';
  const updatedLabel = field.updatedLabel ?? '—';
  const ring = CONFIDENCE_RING[field.moistureConfidenceLevel ?? 'unknown'];

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

      {/* Layer Pills */}
      <LayerPills active={activeLayer} onChange={setActiveLayer} />

      {/* Donut + Info */}
      <div>
        <div className="donut-container__label">
          <div className="donut-container__label-dot" />
          <span className="donut-container__label-text">{contextLabel}</span>
        </div>
        <div className="donut-container">
          <div className="donut-confidence-wrap" title={ring.label}>
            <div
              className={`donut-confidence-ring donut-confidence-ring--${field.moistureConfidenceLevel ?? 'unknown'}`}
              style={{ '--ring-color': ring.color } as React.CSSProperties}
            />
            <DonutChart
              value={field.moisture}
              size={120}
              color={moistureColor}
              caption="Soil moisture"
            />
          </div>
          <div className="donut-info">
            <div className="donut-info__row" data-metric-hint="cloud_cover" data-metric-value={field.cloudCover}>
              <Cloud size={12} className="donut-info__icon" />
              <div className="donut-info__text">
                <span className="donut-info__label">Cloud cover</span>
                <span className="donut-info__value">{field.cloudCover}</span>
              </div>
            </div>
            <div className="donut-info__row" data-metric-hint="surface moisture" data-metric-value={field.surfaceMoisture}>
              <Droplets size={12} className="donut-info__icon" />
              <div className="donut-info__text">
                <span className="donut-info__label">Surface wetness</span>
                <span className="donut-info__value" style={{ color: '#f59e0b' }}>{field.surfaceMoisture}</span>
              </div>
            </div>
            <div className="donut-info__row" data-metric-hint="field_state" data-metric-value={field.fieldState}>
              <Leaf size={12} className="donut-info__icon" />
              <div className="donut-info__text">
                <span className="donut-info__label">Field state</span>
                <span className="donut-info__value" style={{ color: field.fieldStateColor }}>{field.fieldState}</span>
              </div>
            </div>
          </div>
        </div>
        {field.sourceTagExtended ? (
          <span className="donut-source-tag">{field.sourceTagExtended}</span>
        ) : field.moistureDerivationMode && field.moistureDerivationMode !== 'unknown' ? (
          <span className="donut-source-tag">
            {field.moistureDerivationMode === 'source-backed' ? 'Satellite-derived' : 'Modeled estimate'}
            {field.confidenceSub && field.confidenceSub !== 'No source' ? ` · ${field.confidenceSub}` : ''}
          </span>
        ) : null}
      </div>

      {/* CONDITIONS */}
      <div className="panel__section">
        <SectionHeader label="CONDITIONS" meta={conditionsMeta} />
        <div className="panel__data-grid">
          <div className="panel__data-row">
            <div className="panel__data-cell" data-metric-hint="root-moisture" data-metric-value={field.rootMoisture}>
              <div className="panel__data-cell-icon-label">
                <Waves size={12} />
                <span className="panel__data-cell-label">Soil Moisture</span>
              </div>
              <ValueSlot className="panel__data-cell-value">{field.rootMoisture}</ValueSlot>
              <span className="panel__data-cell-sub" style={{ color: 'var(--status-positive)', fontWeight: 600 }}>{field.rootMoistureSub}</span>
            </div>
            <div className="panel__data-cell" data-metric-hint="trend" data-metric-value={field.trend}>
              <div className="panel__data-cell-icon-label">
                <TrendingDown size={12} />
                <span className="panel__data-cell-label">Trend (7d)</span>
              </div>
              <ValueSlot className="panel__data-cell-value panel__data-cell-value--text">
                <TrendingDown size={14} style={{ color: '#f59e0b' }} />
                <span style={{ color: '#f59e0b' }}>{field.trend}</span>
              </ValueSlot>
              <span className="panel__data-cell-sub">{field.trendSub}</span>
            </div>
          </div>
          <div className="panel__data-row">
            <div className="panel__data-cell" data-metric-hint="spread" data-metric-value={field.spread}>
              <div className="panel__data-cell-icon-label">
                <BarChart3 size={12} />
                <span className="panel__data-cell-label">Field Variation</span>
              </div>
              <ValueSlot className="panel__data-cell-value">{field.spread}</ValueSlot>
              <span className="panel__data-cell-sub">{field.spreadSub}</span>
            </div>
            <div className="panel__data-cell" data-metric-hint="confidence" data-metric-value={field.confidence}>
              <div className="panel__data-cell-icon-label">
                <ShieldCheck size={12} />
                <span className="panel__data-cell-label">Confidence</span>
              </div>
              <ValueSlot className="panel__data-cell-value panel__data-cell-value--text" style={{ color: ring.color }}>
                <span className="confidence-dot" style={{ background: ring.color }} />
                {field.confidence}
              </ValueSlot>
              <span className="panel__data-cell-sub">{field.confidenceSub}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ATMOSPHERE */}
      <div className="panel__section">
        <SectionHeader label="ATMOSPHERE" />
        <div className="panel__data-grid">
          <div className="panel__data-row">
            <div className="panel__data-cell" data-metric-hint="precipitation" data-metric-value={field.precipitation}>
              <div className="panel__data-cell-icon-label">
                <Droplets size={12} />
                <span className="panel__data-cell-label">Precipitation</span>
              </div>
              <ValueSlot className="panel__data-cell-value">{field.precipitation}</ValueSlot>
              <span className="panel__data-cell-sub">{field.precipitationSub}</span>
            </div>
            <div className="panel__data-cell" data-metric-hint="precipitation" data-metric-value={field.nextRain}>
              <div className="panel__data-cell-icon-label">
                <Cloud size={12} />
                <span className="panel__data-cell-label">Next Rain</span>
              </div>
              <ValueSlot className="panel__data-cell-value">{field.nextRain}</ValueSlot>
              <span className="panel__data-cell-sub">{field.nextRainSub}</span>
            </div>
          </div>
          <div className="panel__data-row">
            <div className="panel__data-cell" data-metric-hint="precipitation" data-metric-value={field.rainChance}>
              <div className="panel__data-cell-icon-label">
                <Droplets size={12} />
                <span className="panel__data-cell-label">Rain Chance</span>
              </div>
              <ValueSlot className="panel__data-cell-value">{field.rainChance}</ValueSlot>
              <span className="panel__data-cell-sub">{field.rainChanceSub}</span>
            </div>
            <div className="panel__data-cell" data-metric-hint="precipitation" data-metric-value={field.sevenDayTotal}>
              <div className="panel__data-cell-icon-label">
                <Droplets size={12} />
                <span className="panel__data-cell-label">7-Day Total</span>
              </div>
              <ValueSlot className="panel__data-cell-value">{field.sevenDayTotal}</ValueSlot>
              <span className="panel__data-cell-sub" style={{ color: '#f59e0b', fontWeight: 600 }}>{field.sevenDayTotalSub}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ACTIVE ALERTS */}
      <div className="panel__section">
        <SectionHeader label="ACTIVE ALERTS" meta={<span style={{ color: '#ef4444' }}>{field.alerts.length} active</span>} />
        {field.alerts.map((alert, i) => (
          <div className="alert-card" key={i}>
            <div className="alert-card__icon">
              {alert.severity === 'danger' ? (
                <Flame size={16} style={{ color: 'var(--status-danger)' }} />
              ) : (
                <Thermometer size={16} style={{ color: 'var(--status-warning)' }} />
              )}
            </div>
            <div className="alert-card__content">
              <span className="alert-card__label">{alert.label}</span>
              <span className="alert-card__desc">{alert.desc}</span>
            </div>
            <span className={`alert-card__badge alert-card__badge--${alert.severity}`}>
              {alert.severity === 'danger' ? 'High' : 'Medium'}
            </span>
          </div>
        ))}
      </div>

      {/* 7-DAY OUTLOOK */}
      <div className="panel__section">
        <SectionHeader label="7-DAY OUTLOOK" />
        <div className="outlook-grid">
          {field.outlook.map((day, i) => (
            <div className="outlook-card" key={`${day.day}-${i}`}>
              <span className="outlook-card__day">{day.day}</span>
              <Sun size={16} className="outlook-card__icon" />
              <span className="outlook-card__temps">{day.high}/{day.low}</span>
              <span className="outlook-card__precip">{day.precip}</span>
            </div>
          ))}
        </div>
      </div>

      {/* UPDATED TIMESTAMP */}
      <span className="panel__updated">{updatedLabel}</span>

      {/* IMAGE VIEWER */}
      <div className="image-viewer">
        <div className="image-viewer__frames">
          <div className="image-viewer__frame" />
          <div className="image-viewer__frame image-viewer__frame--right" />
          <div className="image-viewer__divider" />
          <div className="image-viewer__handle">
            <ArrowLeftRight size={12} />
          </div>
        </div>
        <div className="image-viewer__caption">
          <div className="image-viewer__meta">
            <span className="image-viewer__status">
              <CheckCircle size={12} /> Clear pass
            </span>
            <span className="image-viewer__date">Mar 26, 2026, 2:00 AM</span>
          </div>
          <span className="image-viewer__title">
            Clear pass — trusted for NDVI assessment.
          </span>
          <span className="image-viewer__desc">
            10m native resolution. Rendered overlays are smoothed for readability.
          </span>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <SectionHeader label="QUICK ACTIONS" />
      <div className="panel__action-row">
        <Button variant="panel-primary" icon={RefreshCw}>Sync Field</Button>
        <Button variant="panel-secondary" icon={FileText}>Report</Button>
      </div>
    </div>
    </MetricHintProvider>
  );
}
