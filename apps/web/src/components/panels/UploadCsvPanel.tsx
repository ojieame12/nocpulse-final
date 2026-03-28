'use client';

import { useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '../ui/Button';
import { PanelHeader } from '../ui/PanelHeader';
import { SectionHeader } from '../ui/SectionHeader';
import { UploadZone } from '../ui/UploadZone';

interface UploadCsvPanelProps {
  onClose?: () => void;
}

const tabs = ['Upload CSV', 'Single LLD Lookup', 'Upload KML'];

const columnMappings = [
  { field: 'Field Name', column: 'Column A' },
  { field: 'Legal Description', column: 'Column B' },
  { field: 'Crop Type', column: 'Column C' },
  { field: 'Area (ha)', column: 'Column D' },
];

const previewFields = [
  { name: 'North Quarter A', area: '64.7 ha', color: 'var(--status-positive)' },
  { name: 'South Quarter C', area: '48.3 ha', color: 'var(--status-warning)' },
  { name: 'West Ridge D', area: '32.8 ha', color: 'var(--status-info)' },
];

export function UploadCsvPanel({ onClose }: UploadCsvPanelProps) {
  const [activeTab, setActiveTab] = useState('Upload CSV');

  return (
    <div className="panel">
      <PanelHeader title="ADD FIELD" onClose={onClose} />
      <div className="panel__body">
        {/* Title */}
        <h2
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '22px',
            fontWeight: 400,
            margin: 0,
          }}
        >
          New Field
        </h2>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            color: 'var(--text-secondary)',
            margin: '4px 0 0',
          }}
        >
          Define a new field boundary and assign crop information.
        </p>

        {/* Tab row */}
        <div className="filter-pills">
          {tabs.map((tab) => (
            <button
              key={tab}
              className={`filter-pill${activeTab === tab ? ' filter-pill--active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* FILE UPLOAD */}
        <SectionHeader label="FILE UPLOAD" />
        <UploadZone title="Drop CSV file here" hint="Supports .csv up to 10MB" accept=".csv" />

        {/* COLUMN MAPPING */}
        <SectionHeader label="COLUMN MAPPING" />
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            color: 'var(--text-secondary)',
            margin: '0 0 8px',
          }}
        >
          Map your CSV columns to NocPulse field attributes.
        </p>
        {columnMappings.map((mapping) => (
          <div
            key={mapping.field}
            className="modal-card__row"
          >
            <span className="modal-card__row-label">{mapping.field}</span>
            <span className="modal-card__row-value">{mapping.column}</span>
          </div>
        ))}

        {/* PREVIEW */}
        <SectionHeader label="PREVIEW (3 FIELDS)" />
        {previewFields.map((field) => (
          <div
            key={field.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 0',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: field.color,
                  flexShrink: 0,
                }}
              />
              {field.name}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                color: 'var(--text-muted)',
              }}
            >
              {field.area}
            </span>
          </div>
        ))}

        {/* Bottom actions */}
        <Button variant="panel-primary" icon={Upload}>
          Import 3 Fields
        </Button>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            color: 'var(--text-muted)',
            textAlign: 'center',
            width: '100%',
            padding: '8px 0',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
