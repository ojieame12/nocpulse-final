'use client';

import { Sprout } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { PanelHeader } from '../ui/PanelHeader';

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
        <div className="crop-stat-tiles">
          <div className="crop-stat-tile crop-stat-tile--green">
            <span className="crop-stat-tile__value crop-stat-tile__value--green">3</span>
            <span className="crop-stat-tile__label">Active Crops</span>
          </div>
          <div className="crop-stat-tile crop-stat-tile--green">
            <span className="crop-stat-tile__value crop-stat-tile__value--green">192.4 ha</span>
            <span className="crop-stat-tile__label">Total</span>
          </div>
          <div className="crop-stat-tile crop-stat-tile--amber">
            <span className="crop-stat-tile__value crop-stat-tile__value--amber">2</span>
            <span className="crop-stat-tile__label">Alerts</span>
          </div>
        </div>

        {crops.map((crop) => (
          <div key={crop.id} className="crop-card">
            <div className="crop-card__header">
              <span className="crop-card__name">
                <Sprout size={14} />
                {crop.name}
              </span>
              <Badge variant={crop.badge}>{crop.badgeLabel}</Badge>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span className="crop-card__detail">Area: {crop.area}</span>
              <span className="crop-card__detail">Growth Stage: {crop.growthStage}</span>
              <span className="crop-card__detail">Planted: {crop.planted}</span>
            </div>

            <div className="crop-card__metrics">
              {crop.metrics.map((metric) => (
                <div
                  key={metric.label}
                  className={`crop-card__metric crop-card__metric--${metric.status}`}
                >
                  <span className="crop-card__metric-label">{metric.label}</span>
                  <span className="crop-card__metric-value">{metric.value}</span>
                </div>
              ))}
            </div>

            <div className="crop-card__fields">
              <span className="crop-card__fields-label">
                FIELDS ({crop.fields.length})
              </span>
              {crop.fields.map((field) => (
                <div key={field.name} className="crop-card__field-row">
                  <span className="crop-card__field-name">{field.name}</span>
                  <div
                    className="crop-card__field-bar"
                    style={{ backgroundColor: healthColor[field.health] }}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
