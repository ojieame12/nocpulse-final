'use client';

import { Sprout } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { PanelHeader } from '../../../components/ui/PanelHeader';

interface CropsPanelProps {
  onClose?: () => void;
}

interface CropMetric {
  label: string;
  value: string;
  tint: 'green' | 'yellow' | 'red';
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
      { label: 'NDVI', value: '0.72', tint: 'green' },
      { label: 'Moisture', value: '34%', tint: 'yellow' },
      { label: 'Health', value: '87', tint: 'green' },
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
      { label: 'NDVI', value: '0.58', tint: 'yellow' },
      { label: 'Moisture', value: '22%', tint: 'red' },
      { label: 'Health', value: '64', tint: 'yellow' },
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
      { label: 'NDVI', value: '0.69', tint: 'green' },
      { label: 'Moisture', value: '38%', tint: 'green' },
      { label: 'Health', value: '79', tint: 'green' },
    ],
    fields: [
      { name: 'North Ridge B', health: 'good' },
    ],
  },
];

const healthColor: Record<string, string> = {
  good: 'var(--status-positive)',
  fair: 'var(--status-warning)',
  poor: 'var(--status-danger)',
};

export function CropsPanel({ onClose }: CropsPanelProps) {
  return (
    <div className="panel">
      <PanelHeader title="CROPS" onClose={onClose} />
      <div className="panel__body">
        {/* Summary stat tiles */}
        <div className="crops-panel__tiles">
          <div className="crops-panel__tile">
            <span className="crops-panel__tile-number">3</span>
            <span className="crops-panel__tile-label">Active Crops</span>
          </div>
          <div className="crops-panel__tile">
            <span className="crops-panel__tile-number">192.4 ha</span>
            <span className="crops-panel__tile-label">Total</span>
          </div>
          <div className="crops-panel__tile">
            <span className="crops-panel__tile-number">2</span>
            <span className="crops-panel__tile-label">Alerts</span>
          </div>
        </div>

        {/* Crop cards */}
        <div className="crops-panel__cards">
          {crops.map((crop) => (
            <div key={crop.id} className="crops-panel__card">
              {/* Header */}
              <div className="crops-panel__card-header">
                <span className="crops-panel__card-name">
                  <span
                    className="crops-panel__dot"
                    style={{ backgroundColor: crop.badge === 'positive' ? 'var(--status-positive)' : 'var(--status-warning)' }}
                  />
                  {crop.name}
                </span>
                <Badge variant={crop.badge}>{crop.badgeLabel}</Badge>
              </div>

              {/* Details */}
              <div className="crops-panel__details">
                <span className="crops-panel__detail">Area: {crop.area}</span>
                <span className="crops-panel__detail">Growth Stage: {crop.growthStage}</span>
                <span className="crops-panel__detail">Planted: {crop.planted}</span>
              </div>

              {/* Metric pills */}
              <div className="crops-panel__metrics">
                {crop.metrics.map((metric) => (
                  <span
                    key={metric.label}
                    className={`crops-panel__pill crops-panel__pill--${metric.tint}`}
                  >
                    {metric.label} {metric.value}
                  </span>
                ))}
              </div>

              {/* Fields sub-section */}
              <div className="crops-panel__fields">
                <span className="crops-panel__fields-label">
                  FIELDS ({crop.fields.length})
                </span>
                {crop.fields.map((field) => (
                  <div key={field.name} className="crops-panel__field-row">
                    <span className="crops-panel__field-name">{field.name}</span>
                    <div
                      className="crops-panel__field-bar"
                      style={{ backgroundColor: healthColor[field.health] }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
