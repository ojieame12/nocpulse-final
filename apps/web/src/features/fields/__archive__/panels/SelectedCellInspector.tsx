'use client';

import { PanelHeader } from '../../../components/ui/PanelHeader';
import { DonutChart } from '../../../components/ui/DonutChart';
import { MapPin } from 'lucide-react';
import { useAppTheme } from '../../../components/layout/WorkspaceShell';

/* ── Static data ── */

const DAILY_MOISTURE = [
  { day: 'M', value: 36 },
  { day: 'T', value: 38 },
  { day: 'W', value: 34 },
  { day: 'T', value: 32 },
  { day: 'F', value: 34 },
  { day: 'S', value: 30 },
  { day: 'S', value: 33 },
];

const NEIGHBORS = [
  { id: 'C11', value: 56.1, stress: false },
  { id: 'C13', value: 55.8, stress: false },
  { id: 'C22', value: 31.2, stress: true },
  { id: 'C02', value: 33.9, stress: true },
];

/* ── Helpers ── */

function moistureColor(pct: number, isDark: boolean): string {
  if (pct < 30) return isDark ? 'rgba(252, 165, 165, 0.85)' : 'var(--status-danger)';
  if (pct < 40) return isDark ? 'rgba(252, 211, 77, 0.85)' : 'var(--status-warning)';
  return isDark ? 'rgba(74, 222, 128, 0.85)' : 'var(--status-positive)';
}

function barHeight(value: number): number {
  const max = 50;
  return Math.round((value / max) * 60);
}

/* ── Component ── */

interface SelectedCellInspectorProps {
  onClose?: () => void;
  onMaximize?: () => void;
}

export default function SelectedCellInspector({
  onClose,
  onMaximize,
}: SelectedCellInspectorProps) {
  const theme = useAppTheme();
  const isDark = theme === 'dark';

  const rootMoisture = 34.2;
  const surfaceMoisture = 22.1;
  const fieldAvg = 38.1;
  const delta = rootMoisture - fieldAvg;
  const deltaColor = delta < 0
    ? (isDark ? 'rgba(252, 165, 165, 0.85)' : 'var(--status-danger)')
    : (isDark ? 'rgba(74, 222, 128, 0.85)' : 'var(--status-positive)');

  return (
    <div className="panel">
      <PanelHeader title="CELL INSPECTOR" onClose={onClose} onMaximize={onMaximize} />

      <div className="panel__body panel__body--gap-20">
        {/* 1. Cell ID */}
        <div className="cell-inspector__id">
          <h2 className="cell-inspector__id-label">NW-3-C12</h2>
          <span className="cell-inspector__id-coords">
            <MapPin size={10} />
            51.23°N, -112.85°W
          </span>
        </div>

        {/* 2. Moisture donut chart */}
        <div className="cell-inspector__donut-wrap">
          <DonutChart
            value={rootMoisture / 100}
            label={`${rootMoisture}%`}
            caption="ROOT MOISTURE"
            size={140}
            color={moistureColor(rootMoisture, isDark)}
          />
        </div>

        {/* 3. Two stat tiles */}
        <div className="cell-inspector__stat-row">
          <div className="cell-inspector__stat-tile">
            <span className="cell-inspector__stat-label">Root Zone</span>
            <span className="cell-inspector__stat-value" style={{ color: moistureColor(rootMoisture, isDark) }}>
              {rootMoisture}%
            </span>
          </div>
          <div className="cell-inspector__stat-tile">
            <span className="cell-inspector__stat-label">Surface</span>
            <span className="cell-inspector__stat-value" style={{ color: moistureColor(surfaceMoisture, isDark) }}>
              {surfaceMoisture}%
            </span>
          </div>
        </div>

        {/* 4. Comparison section */}
        <div className="panel__data-section">
          <span className="panel__data-section-label">COMPARISON</span>
          <div className="cell-inspector__comparison-header">
            <span>Cell</span>
            <span>Field Avg</span>
            <span>Delta</span>
          </div>
          <div className="cell-inspector__comparison-row">
            <span className="cell-inspector__comparison-cell">{rootMoisture}%</span>
            <span className="cell-inspector__comparison-cell">{fieldAvg}%</span>
            <span className="cell-inspector__comparison-cell" style={{ color: deltaColor }}>
              {delta.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* 5. Sensor info section */}
        <div className="panel__data-section">
          <span className="panel__data-section-label">SENSOR INFO</span>
          <div className="cell-inspector__kv-list">
            <div className="cell-inspector__kv">
              <span className="cell-inspector__kv-key">Source</span>
              <span className="cell-inspector__kv-val">Probe SP-84</span>
            </div>
            <div className="cell-inspector__kv">
              <span className="cell-inspector__kv-key">Depth</span>
              <span className="cell-inspector__kv-val">30 cm</span>
            </div>
            <div className="cell-inspector__kv">
              <span className="cell-inspector__kv-key">Confidence</span>
              <span className="cell-inspector__kv-val">94%</span>
            </div>
            <div className="cell-inspector__kv">
              <span className="cell-inspector__kv-key">Last Read</span>
              <span className="cell-inspector__kv-val">34 min ago</span>
            </div>
          </div>
        </div>

        {/* 6. 7-Day Trend */}
        <div className="panel__data-section">
          <div className="cell-inspector__trend-header">
            <span className="panel__data-section-label">7-DAY TREND</span>
            <span className="cell-inspector__trend-range">Mon 21–27</span>
          </div>
          <div className="cell-inspector__bar-chart">
            {DAILY_MOISTURE.map((d, i) => (
              <div key={i} className="cell-inspector__bar-col">
                <div
                  className="cell-inspector__bar"
                  style={{
                    height: barHeight(d.value),
                    backgroundColor: moistureColor(d.value, isDark),
                  }}
                />
                <span className="cell-inspector__bar-label">{d.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 7. Zone & Neighbors */}
        <div className="panel__data-section">
          <span className="panel__data-section-label">ZONE &amp; NEIGHBORS</span>
          <div className="cell-inspector__zone-row">
            <span
              className="cell-inspector__zone-dot"
              style={{ backgroundColor: isDark ? 'rgba(252, 211, 77, 0.85)' : 'var(--status-warning)' }}
            />
            <span className="cell-inspector__zone-text">
              NW-3 · Moisture Stress · Moderate
            </span>
          </div>
          <div className="cell-inspector__neighbors-grid">
            {NEIGHBORS.map((n) => (
              <div
                key={n.id}
                className={`cell-inspector__neighbor${n.stress ? ' cell-inspector__neighbor--stress' : ''}`}
              >
                <span className="cell-inspector__neighbor-id">{n.id}</span>
                <span className="cell-inspector__neighbor-val" style={{ color: moistureColor(n.value, isDark) }}>
                  {n.value}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 8. Footer timestamp */}
        <div className="cell-inspector__footer">
          UPDATED MAR 27, 2025, 11:34 AM
        </div>
      </div>
    </div>
  );
}
