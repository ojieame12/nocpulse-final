'use client';

import { PanelHeader } from '../../../components/ui/PanelHeader';
import {
  ArrowDown,
  CircleDot,
  ClipboardCheck,
  History,
} from 'lucide-react';

/* ── Static data ── */

const NDVI_TREND = [
  { date: 'Feb 10', value: 0.74, color: '#16a34a' },
  { date: 'Feb 28', value: 0.73, color: '#16a34a' },
  { date: 'Mar 10', value: 0.71, color: '#22c55e' },
  { date: 'Mar 17', value: 0.68, color: '#f59e0b' },
  { date: 'Mar 20', value: 0.64, color: '#f97316' },
  { date: 'Mar 26', value: 0.60, color: '#ef4444' },
];

const INSPECTION_TARGETS = [
  {
    id: 'a',
    label: 'Target A',
    description: 'NW corner stress zone',
    coords: '34.0522° N, 118.2437° W',
    color: '#ef4444',
  },
  {
    id: 'b',
    label: 'Target B',
    description: 'East drainage edge',
    coords: '34.0518° N, 118.2401° W',
    color: '#f97316',
  },
];

/* ── Component ── */

export function EvidencePanel() {
  return (
    <div className="evidence__root">
      <PanelHeader title="NDVI DROP EVIDENCE" />

      <div className="evidence__body">
        {/* Title block */}
        <div className="evidence__title-block">
          <h2 className="evidence__title">NDVI Drop Evidence</h2>
          <div className="evidence__subtitle-row">
            <span className="evidence__subtitle">
              North Quarter A · Zone NW-3
            </span>
            <span className="evidence__badge-urgent">URGENT</span>
            <span className="evidence__time">5h ago</span>
          </div>
        </div>

        {/* Current vs Previous */}
        <div className="evidence__comparison">
          <div className="evidence__comparison-col">
            <span className="evidence__comparison-value evidence__comparison-value--red">
              0.60
            </span>
            <span className="evidence__comparison-label">CURRENT</span>
          </div>

          <div className="evidence__comparison-arrow">
            <ArrowDown size={16} />
            <span className="evidence__comparison-delta">-0.12</span>
          </div>

          <div className="evidence__comparison-col">
            <span className="evidence__comparison-value evidence__comparison-value--green">
              0.72
            </span>
            <span className="evidence__comparison-label">PREVIOUS</span>
          </div>
        </div>

        {/* Image comparison placeholder */}
        <div className="evidence__image-placeholder" />

        {/* NDVI Trend */}
        <div className="evidence__section">
          <h3 className="evidence__section-header">
            NDVI TREND ({NDVI_TREND.length} CAPTURES)
          </h3>
          <div className="evidence__trend-strip">
            {NDVI_TREND.map((entry) => (
              <div key={entry.date} className="evidence__trend-item">
                <div
                  className="evidence__trend-swatch"
                  style={{ background: entry.color }}
                />
                <span className="evidence__trend-date">{entry.date}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Inspection Targets */}
        <div className="evidence__section">
          <h3 className="evidence__section-header">INSPECTION TARGETS</h3>
          {INSPECTION_TARGETS.map((target) => (
            <div key={target.id} className="evidence__target-card">
              <CircleDot
                size={16}
                className="evidence__target-dot"
                style={{ color: target.color }}
              />
              <div className="evidence__target-info">
                <span className="evidence__target-name">
                  {target.label} — {target.description}
                </span>
                <span className="evidence__target-coords">
                  {target.coords}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="evidence__actions">
          <button type="button" className="evidence__action-btn">
            <ClipboardCheck size={15} />
            Start Inspection
          </button>
          <button type="button" className="evidence__action-btn">
            <History size={15} />
            View History
          </button>
        </div>
      </div>
    </div>
  );
}
