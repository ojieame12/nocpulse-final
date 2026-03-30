'use client';

import { Settings, X } from 'lucide-react';
import { DonutChart } from '../../../components/ui/DonutChart';
import { Badge } from '../../../components/ui/Badge';

/* ── Types ── */

type Severity = 'high' | 'moderate' | 'low';

interface DiseaseEntry {
  name: string;
  risk: number;
  severity: Severity;
}

/* ── Static data ── */

const DISEASES: DiseaseEntry[] = [
  { name: 'Sclerotinia Stem Rot', risk: 78, severity: 'high' },
  { name: 'Blackleg', risk: 65, severity: 'high' },
  { name: 'Clubroot', risk: 42, severity: 'moderate' },
  { name: 'Alternaria Black Spot', risk: 38, severity: 'moderate' },
  { name: 'White Mold', risk: 12, severity: 'low' },
];

const SPRAY_ROWS: { label: string; value: string; color?: string }[] = [
  { label: 'Fungicide window', value: 'Open — 48h', color: 'var(--status-positive)' },
  { label: 'Priority target', value: 'Sclerotinia' },
  { label: 'Recommended product', value: 'Proline GOLD' },
  { label: 'Economic threshold', value: 'Exceeded (>50%)', color: 'var(--status-danger)' },
];

const SEVERITY_CONFIG: Record<Severity, { label: string; color: string; badge: 'danger' | 'warning' | 'positive' }> = {
  high: { label: 'HIGH', color: 'var(--status-danger)', badge: 'danger' },
  moderate: { label: 'MODERATE', color: 'var(--status-warning)', badge: 'warning' },
  low: { label: 'LOW', color: 'var(--status-positive)', badge: 'positive' },
};

/* ── Helpers ── */

function countBySeverity(sev: Severity): number {
  return DISEASES.filter((d) => d.severity === sev).length;
}

/* ── Main panel ── */

interface DiseaseRiskPanelProps {
  onClose?: () => void;
  onSettings?: () => void;
}

export function DiseaseRiskPanel({ onClose, onSettings }: DiseaseRiskPanelProps) {
  return (
    <div className="disease-risk">
      {/* ── Header ── */}
      <div className="panel__header">
        <span className="panel__header-title">DISEASE RISK</span>
        <div className="panel__header-actions">
          {onSettings && (
            <button type="button" className="panel__header-btn" onClick={onSettings}>
              <Settings size={14} />
            </button>
          )}
          {onClose && (
            <button type="button" className="panel__header-btn" onClick={onClose}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="panel__body">
        {/* ── Crop indicator ── */}
        <div className="disease-risk__crop-indicator">
          <span className="disease-risk__crop-dot" />
          <span className="disease-risk__crop-name">Canola</span>
          <span className="disease-risk__crop-detail">Flowering &middot; GDD 1,847</span>
        </div>

        {/* ── Risk Overview ── */}
        <div className="panel__data-section">
          <span className="panel__data-section-label">RISK OVERVIEW</span>
          <div className="disease-risk__overview">
            <div className="disease-risk__donut-wrap">
              <DonutChart
                value={0.65}
                label="65%"
                caption="Overall Risk"
                size={120}
                color="var(--status-warning)"
              />
              <Badge variant="warning" className="disease-risk__elevated-badge">Elevated</Badge>
            </div>
            <div className="disease-risk__breakdown">
              <div className="disease-risk__breakdown-row">
                <span className="disease-risk__breakdown-dot" style={{ background: 'var(--status-danger)' }} />
                <span className="disease-risk__breakdown-text">{countBySeverity('high')} High Risk</span>
              </div>
              <div className="disease-risk__breakdown-row">
                <span className="disease-risk__breakdown-dot" style={{ background: 'var(--status-warning)' }} />
                <span className="disease-risk__breakdown-text">{countBySeverity('moderate')} Moderate</span>
              </div>
              <div className="disease-risk__breakdown-row">
                <span className="disease-risk__breakdown-dot" style={{ background: 'var(--status-positive)' }} />
                <span className="disease-risk__breakdown-text">{countBySeverity('low')} Low Risk</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Active Risks ── */}
        <div className="disease-risk__section">
          <span className="disease-risk__section-header">
            ACTIVE RISKS <span className="disease-risk__section-count">&middot; {DISEASES.length} diseases detected</span>
          </span>
          <div className="disease-risk__risks-container">
            {DISEASES.map((d, i) => (
              <div
                key={d.name}
                className={`disease-risk__risk-row${i < DISEASES.length - 1 ? ' disease-risk__risk-row--bordered' : ''}`}
              >
                <span className="disease-risk__risk-dot" style={{ background: SEVERITY_CONFIG[d.severity].color }} />
                <span className="disease-risk__risk-name">{d.name}</span>
                <span className="disease-risk__risk-pct">{d.risk}%</span>
                <Badge variant={SEVERITY_CONFIG[d.severity].badge} className="disease-risk__risk-badge">
                  {SEVERITY_CONFIG[d.severity].label}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* ── Spray Considerations ── */}
        <div className="panel__data-section">
          <span className="panel__data-section-label">SPRAY CONSIDERATIONS</span>
          <div className="disease-risk__spray-list">
            {SPRAY_ROWS.map((row) => (
              <div key={row.label} className="disease-risk__spray-row">
                <span className="disease-risk__spray-label">{row.label}</span>
                <span className="disease-risk__spray-value" style={row.color ? { color: row.color } : undefined}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Footer timestamp ── */}
        <span className="disease-risk__timestamp">UPDATED MAR 27, 2026, 11:34 AM</span>
      </div>
    </div>
  );
}

export { DiseaseRiskPanel as default };
