'use client';

import { X, Copy, Printer, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { SectionHeader } from '../ui/SectionHeader';

interface ShareBriefModalProps {
  onClose?: () => void;
}

const dataRows = [
  { label: 'Crop Type', value: 'Canola' },
  { label: 'Area', value: '64.2 ha' },
  { label: 'LLD', value: 'SE 25-010-17 W4M' },
  { label: 'Health', value: 'Good', color: 'var(--status-positive)' },
  { label: 'Latest capture', value: 'Mar 26 2025' },
];

const alerts = [
  { title: 'Soil moisture below threshold', severity: 'Medium', variant: 'warning' as const },
  { title: 'Frost risk detected overnight', severity: 'High', variant: 'danger' as const },
];

export function ShareBriefModal({ onClose }: ShareBriefModalProps) {
  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-card__header">
          <div className="modal-card__title">
            <div className="modal-card__title-dot" />
            North Quarter A
          </div>
          <button type="button" className="modal-card__close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Data rows */}
        {dataRows.map((row) => (
          <div key={row.label} className="modal-card__row">
            <span className="modal-card__row-label">{row.label}</span>
            <span
              className="modal-card__row-value"
              style={row.color ? { color: row.color } : undefined}
            >
              {row.value}
            </span>
          </div>
        ))}

        {/* NDVI row */}
        <div className="modal-card__row">
          <span className="modal-card__row-label">NDVI</span>
          <span className="modal-card__row-value">
            0.72{' '}
            <span style={{ color: 'var(--status-positive)' }}>+0.04</span>
          </span>
        </div>

        {/* Root moisture */}
        <div className="modal-card__row">
          <span className="modal-card__row-label">Root moisture</span>
          <span className="modal-card__row-value" style={{ color: 'var(--status-positive)' }}>
            22%
          </span>
        </div>

        {/* ACTIVE ALERTS */}
        <SectionHeader label="ACTIVE ALERTS" />
        {alerts.map((alert) => (
          <div key={alert.title} className="modal-card__row">
            <span
              className="modal-card__row-label"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <AlertTriangle size={12} />
              {alert.title}
            </span>
            <Badge variant={alert.variant}>{alert.severity}</Badge>
          </div>
        ))}

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
          <Button variant="panel-primary" icon={Copy}>
            Copy
          </Button>
          <Button variant="panel-secondary" icon={Printer}>
            Print
          </Button>
        </div>
      </div>
    </div>
  );
}
