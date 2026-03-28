'use client';

import { PanelHeader } from '../../../components/ui/PanelHeader';
import { Badge } from '../../../components/ui/Badge';

/* ── Types ── */

interface SpectralIndex {
  label: string;
  value: number;
  bars: number[]; // 0–1 heights for mini bar chart
}

interface ConfigRow {
  label: string;
  value: string;
}

/* ── Static data ── */

const COLLECTION_METRICS = [
  { label: 'PRESSURE', value: 'P 0.64 kPa' },
  { label: 'POINT DENSITY', value: '10,478 pts' },
  { label: 'VPD', value: '0.92 VPD' },
];

const VEG_SEGMENTS = [
  { label: 'OPTIMAL', percent: 62, color: 'var(--primary-green)' },
  { label: 'CAUTION', percent: 26, color: 'var(--status-warning)' },
  { label: 'STRESS', percent: 12, color: 'var(--status-danger)' },
];

const SPECTRAL_INDICES: SpectralIndex[] = [
  { label: 'NDVI', value: 0.72, bars: [0.6, 0.8, 0.95, 0.7, 0.85, 0.9] },
  { label: 'NDRE', value: 0.41, bars: [0.4, 0.55, 0.5, 0.35, 0.45, 0.42] },
  { label: 'NDMI', value: -0.08, bars: [0.2, 0.15, 0.1, 0.18, 0.12, 0.08] },
];

const CAPTURE_CONFIG: ConfigRow[] = [
  { label: 'Satellite', value: 'Sentinel-2A' },
  { label: 'Bands', value: 'B02, B03, B04, B08' },
  { label: 'Resolution', value: '10 m/px' },
  { label: 'SZA', value: '34.2°' },
];

/* ── Mini bar chart ── */

function MiniBarChart({ bars, negative }: { bars: number[]; negative?: boolean }) {
  const barColor = negative ? 'var(--status-danger)' : 'var(--primary-green)';
  return (
    <div className="scout-report__mini-bars">
      {bars.map((h, i) => (
        <div
          key={i}
          className="scout-report__mini-bar"
          style={{ height: `${Math.round(h * 100)}%`, background: barColor }}
        />
      ))}
    </div>
  );
}

/* ── Component ── */

interface ScoutReportPanelProps {
  onClose?: () => void;
  onMaximize?: () => void;
}

export default function ScoutReportPanel({ onClose, onMaximize }: ScoutReportPanelProps) {
  return (
    <div className="scout-report">
      <PanelHeader title="FIELD SCOUT REPORT" onClose={onClose} onMaximize={onMaximize} />

      <div className="panel__body">
        {/* 1. Title + badge */}
        <div className="scout-report__title-row">
          <div className="panel__title-section">
            <span className="panel__title-main">Scout Report</span>
            <span className="panel__title-sub">Quarter SE 25 010 17 W4 · Oct 12, 2025</span>
          </div>
          <Badge variant="positive" dot>HEALTHY</Badge>
        </div>

        {/* 2. Collection Metrics */}
        <div className="scout-report__section">
          <span className="panel__section-label">COLLECTION METRICS</span>
          <div className="scout-report__metrics-row">
            {COLLECTION_METRICS.map((m) => (
              <div key={m.label} className="scout-report__metric-tile">
                <span className="scout-report__metric-value">{m.value}</span>
                <span className="scout-report__metric-label">{m.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Vegetation Status */}
        <div className="scout-report__section">
          <span className="panel__section-label">VEGETATION STATUS</span>
          <div className="scout-report__veg-card">
            <div className="scout-report__veg-bar">
              {VEG_SEGMENTS.map((seg) => (
                <div
                  key={seg.label}
                  className="scout-report__veg-segment"
                  style={{ width: `${seg.percent}%`, background: seg.color }}
                />
              ))}
            </div>
            <div className="scout-report__veg-legend">
              {VEG_SEGMENTS.map((seg) => (
                <div key={seg.label} className="scout-report__veg-legend-item">
                  <span
                    className="scout-report__veg-legend-dot"
                    style={{ background: seg.color }}
                  />
                  <span className="scout-report__veg-legend-text">
                    {seg.label} {seg.percent}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 4. Spectral Indices */}
        <div className="scout-report__section">
          <span className="panel__section-label">SPECTRAL INDICES</span>
          <div className="scout-report__spectral-list">
            {SPECTRAL_INDICES.map((idx) => {
              const isNegative = idx.value < 0;
              return (
                <div key={idx.label} className="scout-report__spectral-card">
                  <span className="scout-report__spectral-label">{idx.label}</span>
                  <span
                    className={`scout-report__spectral-value${isNegative ? ' scout-report__spectral-value--negative' : ''}`}
                  >
                    {idx.value.toFixed(2)}
                  </span>
                  <MiniBarChart bars={idx.bars} negative={isNegative} />
                </div>
              );
            })}
          </div>
        </div>

        {/* 5. Crop Stress Risk Profile */}
        <div className="scout-report__section">
          <span className="panel__section-label">CROP STRESS RISK PROFILE</span>
          <div className="scout-report__risk-card">
            <div className="scout-report__risk-chart">
              <div className="scout-report__risk-placeholder">
                <svg width="100%" height="100%" viewBox="0 0 200 80" preserveAspectRatio="none">
                  <polyline
                    points="0,60 30,50 60,40 90,35 120,30 150,38 180,28 200,32"
                    fill="none"
                    stroke="var(--primary-green)"
                    strokeWidth="2"
                  />
                  <polyline
                    points="0,60 30,50 60,40 90,35 120,30 150,38 180,28 200,32"
                    fill="url(#riskGrad)"
                    stroke="none"
                  />
                  <defs>
                    <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary-green)" stopOpacity="0.15" />
                      <stop offset="100%" stopColor="var(--primary-green)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>
            <span className="scout-report__risk-label">Apr 10–18</span>
          </div>
        </div>

        {/* 6. Capture Configuration */}
        <div className="scout-report__section">
          <span className="panel__section-label">CAPTURE CONFIGURATION</span>
          <div className="scout-report__config-card">
            {CAPTURE_CONFIG.map((row) => (
              <div key={row.label} className="scout-report__config-row">
                <span className="scout-report__config-key">{row.label}</span>
                <span className="scout-report__config-value">{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 7. Footer timestamp */}
        <div className="scout-report__footer">
          Last synced Oct 12, 2025 · 14:32 UTC
        </div>
      </div>
    </div>
  );
}
