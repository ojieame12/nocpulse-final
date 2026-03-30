'use client';

import { Sprout } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { PanelHeader } from '../ui/PanelHeader';
import { useAppTheme } from '../layout/WorkspaceShell';

interface CropsPanelProps {
  onClose?: () => void;
}

interface CropMetric {
  label: string;
  value: string;
  status: 'good' | 'fair' | 'poor';
}

interface CropField {
  name: string;
  health: 'good' | 'fair' | 'poor';
}

interface CropData {
  id: number;
  name: string;
  badge: 'positive' | 'warning';
  badgeLabel: string;
  area: string;
  growthStage: string;
  planted: string;
  metrics: CropMetric[];
  fields: CropField[];
}

const crops: CropData[] = [
  {
    id: 1,
    name: 'Canola',
    badge: 'positive',
    badgeLabel: 'Good',
    area: '64.2 ha',
    growthStage: 'Flowering',
    planted: 'Apr 15',
    metrics: [
      { label: 'NDVI', value: '0.72', status: 'good' },
      { label: 'Moisture', value: '34%', status: 'fair' },
      { label: 'Health', value: '87', status: 'good' },
    ],
    fields: [
      { name: 'North Quarter A', health: 'good' },
      { name: 'South Quarter C', health: 'good' },
      { name: 'West Ridge D', health: 'good' },
    ],
  },
  {
    id: 2,
    name: 'Spring Wheat',
    badge: 'warning',
    badgeLabel: 'Fair',
    area: '86.1 ha',
    growthStage: 'Tillering',
    planted: 'May 2',
    metrics: [
      { label: 'NDVI', value: '0.58', status: 'fair' },
      { label: 'Moisture', value: '22%', status: 'poor' },
      { label: 'Health', value: '64', status: 'fair' },
    ],
    fields: [
      { name: 'East Paddock', health: 'fair' },
      { name: 'South D Quarter B', health: 'fair' },
    ],
  },
  {
    id: 3,
    name: 'Flax',
    badge: 'positive',
    badgeLabel: 'Good',
    area: '42.1 ha',
    growthStage: 'Budding',
    planted: 'May 10',
    metrics: [
      { label: 'NDVI', value: '0.69', status: 'good' },
      { label: 'Moisture', value: '38%', status: 'good' },
      { label: 'Health', value: '79', status: 'good' },
    ],
    fields: [{ name: 'North Ridge B', health: 'good' }],
  },
];

function getStatusColor(status: 'good' | 'fair' | 'poor', isDark: boolean): { text: string; bg: string } {
  if (status === 'good') {
    return isDark
      ? { text: 'rgba(74, 222, 128, 0.85)', bg: 'rgba(74, 222, 128, 0.05)' }
      : { text: '#16a34a', bg: 'rgba(22, 163, 74, 0.06)' };
  }
  if (status === 'fair') {
    return isDark
      ? { text: 'rgba(252, 211, 77, 0.85)', bg: 'rgba(252, 211, 77, 0.05)' }
      : { text: '#d97706', bg: 'rgba(245, 158, 11, 0.06)' };
  }
  // poor
  return isDark
    ? { text: 'rgba(252, 165, 165, 0.85)', bg: 'rgba(252, 165, 165, 0.05)' }
    : { text: '#dc2626', bg: 'rgba(239, 68, 68, 0.06)' };
}

function getHealthBarColor(status: 'good' | 'fair' | 'poor', isDark: boolean): string {
  if (status === 'good') return isDark ? 'rgba(74,222,128,0.85)' : '#16a34a';
  if (status === 'fair') return isDark ? 'rgba(252,211,77,0.85)' : '#f59e0b';
  return isDark ? 'rgba(252,165,165,0.85)' : '#ef4444';
}

export function CropsPanel({ onClose }: CropsPanelProps) {
  const theme = useAppTheme();
  const isDark = theme === 'dark';

  // Calculate summary stats
  const activeCrops = crops.length;
  const totalArea = crops.reduce((sum, crop) => {
    const area = parseFloat(crop.area);
    return sum + (isNaN(area) ? 0 : area);
  }, 0);
  const avgHealth = Math.round(
    crops.reduce((sum, crop) => {
      const healthMetric = crop.metrics.find(m => m.label === 'Health');
      const health = healthMetric ? parseFloat(healthMetric.value) : 0;
      return sum + (isNaN(health) ? 0 : health);
    }, 0) / crops.length
  );
  const alertCount = crops.filter(crop => crop.badge === 'warning').length;

  return (
    <div className="panel">
      <PanelHeader title="CROPS" onClose={onClose} />
      <div className="panel__body">
        {/* Summary row: 4-column stat cards */}
        <div className="fdp__body" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
          {/* Card 1: ACTIVE CROPS */}
          <div className="fdp-card">
            <span className="fdp-lbl fdp-lbl--muted">Active Crops</span>
            <span className="fdp-big fdp-big--26" style={{ color: getStatusColor('good', isDark).text }}>
              {activeCrops}
            </span>
          </div>

          {/* Card 2: TOTAL AREA */}
          <div className="fdp-card">
            <span className="fdp-lbl fdp-lbl--muted">Total Area</span>
            <span className="fdp-big fdp-big--26" style={{ color: isDark ? 'rgba(147,197,253,0.85)' : '#3b82f6' }}>
              {totalArea.toFixed(1)} ha
            </span>
          </div>

          {/* Card 3: AVG HEALTH */}
          <div className="fdp-card">
            <span className="fdp-lbl fdp-lbl--muted">Avg Health</span>
            <span className="fdp-big fdp-big--26" style={{ color: getStatusColor('good', isDark).text }}>
              {avgHealth}
            </span>
          </div>

          {/* Card 4: ALERTS */}
          <div className="fdp-card fdp-card--warning">
            <span className="fdp-lbl fdp-lbl--muted">Alerts</span>
            <span className="fdp-big fdp-big--26" style={{ color: getStatusColor('fair', isDark).text }}>
              {alertCount}
            </span>
          </div>
        </div>

        {/* Per-crop cards */}
        {crops.map((crop) => {
          const healthMetric = crop.metrics.find(m => m.label === 'Health');
          const healthValue = healthMetric ? parseFloat(healthMetric.value) : 0;
          const healthPercent = (healthValue / 100) * 100;

          return (
            <div key={crop.id} className="fdp-card fdp-card--span-full">
              {/* Top row: icon + name + badge */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sprout size={14} style={{ color: 'var(--text-secondary)' }} />
                  <span className="fdp-lbl">{crop.name}</span>
                </div>
                <Badge variant={crop.badge}>{crop.badgeLabel}</Badge>
              </div>

              {/* Sub row: area · stage · planted */}
              <span className="fdp-sub">
                {crop.area} · {crop.growthStage} · Planted {crop.planted}
              </span>

              {/* Metrics row: 3-column mini metric cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                {crop.metrics.map((metric) => {
                  const colors = getStatusColor(metric.status, isDark);
                  return (
                    <div
                      key={metric.label}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '8px',
                        background: colors.bg,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '3px',
                      }}
                    >
                      <span className="fdp-lbl" style={{ color: colors.text }}>
                        {metric.label}
                      </span>
                      <span className="fdp-big fdp-big--20" style={{ color: colors.text }}>
                        {metric.value}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Health bar */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span className="fdp-lbl fdp-lbl--muted">Health Score</span>
                <div className="fdp-prog" style={{ height: '6px' }}>
                  <div
                    className="fdp-prog__fill"
                    style={{
                      width: `${healthPercent}%`,
                      background: getHealthBarColor(healthMetric?.status || 'poor', isDark),
                    }}
                  />
                </div>
              </div>

              {/* Fields list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span className="fdp-lbl fdp-lbl--muted">Fields ({crop.fields.length})</span>
                {crop.fields.map((field) => (
                  <div
                    key={field.name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '11px',
                    }}
                  >
                    <div
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: getHealthBarColor(field.health, isDark),
                        flexShrink: 0,
                      }}
                    />
                    <span className="fdp-sub">{field.name}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Footer: timestamp */}
        <span className="fdp-sub" style={{ paddingTop: '8px', textAlign: 'center' }}>
          Last updated {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      </div>
    </div>
  );
}
