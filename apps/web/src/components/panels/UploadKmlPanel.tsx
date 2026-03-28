'use client';

import { useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '../ui/Button';
import { PanelHeader } from '../ui/PanelHeader';
import { SectionHeader } from '../ui/SectionHeader';
import { Toggle } from '../ui/Toggle';
import { UploadZone } from '../ui/UploadZone';

interface UploadKmlPanelProps {
  onClose?: () => void;
}

const tabs = ['Upload CSV', 'Single LLD Lookup', 'Upload KML'];

const detectedBoundaries = [
  { name: 'North Quarter A', area: '84.3 ha' },
  { name: 'South Quarter C', area: '73.1 ha' },
  { name: 'West Ridge D', area: '32.8 ha' },
  { name: 'East Paddock', area: '47.3 ha' },
];

const crsRows = [
  { label: 'CRS', value: 'EPSG: 4326 (WGS 84)' },
  { label: 'Datum', value: '4 polygons' },
  { label: '', value: '10 vertices avg' },
];

export function UploadKmlPanel({ onClose }: UploadKmlPanelProps) {
  const [activeTab, setActiveTab] = useState('Upload KML');
  const [simplify, setSimplify] = useState(true);
  const [autoDetect, setAutoDetect] = useState(true);
  const [mergeOverlapping, setMergeOverlapping] = useState(true);

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
        <UploadZone
          title="Drop KML or KMZ file here"
          hint="Supports KML/KMZ (.kml)"
          accept=".kml,.kmz"
        />

        {/* IMPORT OPTIONS */}
        <SectionHeader label="IMPORT OPTIONS" />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 0',
          }}
        >
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px' }}>
            Simplify boundaries
          </span>
          <Toggle checked={simplify} onChange={setSimplify} />
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 0',
          }}
        >
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px' }}>
            Auto-detect crop type from metadata
          </span>
          <Toggle checked={autoDetect} onChange={setAutoDetect} />
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 0',
          }}
        >
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px' }}>
            Merge overlapping polygons
          </span>
          <Toggle checked={mergeOverlapping} onChange={setMergeOverlapping} />
        </div>

        {/* DETECTED BOUNDARIES */}
        <SectionHeader label="DETECTED BOUNDARIES (4)" />
        {detectedBoundaries.map((boundary) => (
          <div
            key={boundary.name}
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
                  backgroundColor: 'var(--status-positive)',
                  flexShrink: 0,
                }}
              />
              {boundary.name}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                color: 'var(--text-muted)',
              }}
            >
              {boundary.area}
            </span>
          </div>
        ))}
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            fontWeight: 700,
            padding: '10px 0',
          }}
        >
          Total Area: 192.4 ha
        </div>

        {/* COORDINATE REFERENCE */}
        <SectionHeader label="COORDINATE REFERENCE" />
        {crsRows.map((row, i) => (
          <div key={i} className="modal-card__row">
            <span className="modal-card__row-label">{row.label}</span>
            <span className="modal-card__row-value">{row.value}</span>
          </div>
        ))}

        {/* Bottom actions */}
        <Button variant="panel-primary" icon={Upload}>
          Import 4 Fields
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
