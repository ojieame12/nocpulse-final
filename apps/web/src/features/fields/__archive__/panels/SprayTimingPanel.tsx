'use client';

import {
  Wind,
  Thermometer,
  CloudRain,
  CheckCircle,
  AlertTriangle,
  Bell,
  Share2,
} from 'lucide-react';
import { PanelHeader } from '../../../components/ui/PanelHeader';

/* ── Types ── */

interface SprayWindow {
  label: string;
  status: 'go' | 'fair';
}

interface WeatherFactor {
  label: string;
  value: string;
}

interface Restriction {
  text: string;
}

/* ── Static data ── */

const ALTERNATIVE_WINDOWS: SprayWindow[] = [
  { label: 'Mon 23 · 06:00 – 14:00', status: 'go' },
  { label: 'Mon 23 · 14:00 – 18:00', status: 'go' },
  { label: 'Mon 25 · 06:00 – 14:00', status: 'fair' },
];

const WEATHER_FACTORS: WeatherFactor[] = [
  { label: 'Precipitation', value: '18 mm' },
  { label: 'Humidity', value: '71%' },
  { label: 'Wind speed', value: '6 m/s' },
  { label: 'Dew point', value: '4°C' },
];

const RESTRICTIONS: Restriction[] = [
  { text: 'Buffer zone 600m from Belly River (10-12 km/h)' },
  { text: 'No spray within 3h before to 4°C' },
  { text: 'Max 1hr 15min @ 30 kPa rate (0.27 L/ha) for Proline' },
];

/* ── Component ── */

interface SprayTimingPanelProps {
  onClose?: () => void;
}

export function SprayTimingPanel({ onClose }: SprayTimingPanelProps) {
  return (
    <div className="panel">
      <PanelHeader title="SPRAY WINDOW" onClose={onClose} />

      <div className="panel__body">
        {/* Title */}
        <div className="spray-timing__title-block">
          <h2 className="spray-timing__title">Spray Timing Calculator</h2>
          <span className="spray-timing__subtitle">
            Canola · InVigor L233P · Quarter SE 25
          </span>
        </div>

        {/* Next Optimal Window */}
        <div className="spray-timing__optimal">
          <span className="panel__section-label">NEXT OPTIMAL WINDOW</span>
          <div className="spray-timing__optimal-card">
            <span className="spray-timing__optimal-time">
              Mar 28, 06:00 — 10:00
            </span>
            <span className="spray-timing__optimal-sub">
              4 hours of optimal spray
            </span>
            <span className="spray-timing__available-badge">AVAILABLE NOW</span>
          </div>
        </div>

        {/* Surface Conditions */}
        <div className="spray-timing__section">
          <div className="spray-timing__section-header">
            <span className="panel__section-label">SURFACE CONDITIONS</span>
            <span className="spray-timing__go-badge">
              <CheckCircle size={12} />
              GO
            </span>
          </div>
          <div className="spray-timing__conditions">
            <div className="spray-timing__condition-tile">
              <Wind size={16} className="spray-timing__condition-icon" />
              <span className="spray-timing__condition-value">12</span>
              <span className="spray-timing__condition-label">km/h</span>
            </div>
            <div className="spray-timing__condition-tile">
              <Thermometer size={16} className="spray-timing__condition-icon" />
              <span className="spray-timing__condition-value">14°C</span>
              <span className="spray-timing__condition-label">Temp</span>
            </div>
            <div className="spray-timing__condition-tile">
              <CloudRain size={16} className="spray-timing__condition-icon" />
              <span className="spray-timing__condition-value">0%</span>
              <span className="spray-timing__condition-label">Rain chance</span>
            </div>
          </div>
        </div>

        {/* Alternative Spray Windows */}
        <div className="spray-timing__section">
          <span className="panel__section-label">ALTERNATIVE SPRAY WINDOWS</span>
          <div className="spray-timing__alt-list">
            {ALTERNATIVE_WINDOWS.map((w) => (
              <div key={w.label} className="spray-timing__alt-row">
                <span className="spray-timing__alt-label">{w.label}</span>
                <span
                  className={`spray-timing__status-badge spray-timing__status-badge--${w.status}`}
                >
                  {w.status === 'go' ? 'GO' : 'FAIR'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Application Details */}
        <div className="panel__data-section">
          <span className="panel__data-section-label">APPLICATION DETAILS</span>
          <div className="spray-timing__kv-list">
            <div className="spray-timing__kv-row">
              <span className="spray-timing__kv-key">Product</span>
              <span className="spray-timing__kv-value">Proline GOLD</span>
            </div>
            <div className="spray-timing__kv-row">
              <span className="spray-timing__kv-key">Target</span>
              <span className="spray-timing__kv-value">Sclerotinia</span>
            </div>
          </div>
        </div>

        {/* Restrictions */}
        <div className="spray-timing__restrictions">
          <span className="panel__section-label">RESTRICTIONS</span>
          <div className="spray-timing__restrictions-card">
            {RESTRICTIONS.map((r) => (
              <div key={r.text} className="spray-timing__restriction-item">
                <AlertTriangle
                  size={14}
                  className="spray-timing__restriction-icon"
                />
                <span className="spray-timing__restriction-text">{r.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Weather Factors */}
        <div className="panel__data-section">
          <span className="panel__data-section-label">WEATHER FACTORS</span>
          <div className="spray-timing__kv-list">
            {WEATHER_FACTORS.map((f) => (
              <div key={f.label} className="spray-timing__kv-row">
                <span className="spray-timing__kv-key">{f.label}</span>
                <span className="spray-timing__kv-value">{f.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="spray-timing__actions">
          <button type="button" className="spray-timing__action-btn">
            <Bell size={14} />
            Set Reminder
          </button>
          <button type="button" className="spray-timing__action-btn">
            <Share2 size={14} />
            Share Window
          </button>
        </div>
      </div>
    </div>
  );
}
