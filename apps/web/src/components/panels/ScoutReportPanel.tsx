'use client';

import { CircleCheck, TriangleAlert } from 'lucide-react';
import { PanelHeader } from '../ui';

interface ScoutReportPanelProps {
  onClose?: () => void;
}

/* ── Spectral indices data ── */

const spectralIndices = [
  { name: 'NDVI', value: '0.72', valueColor: '#16a34a', range: '0.55\u20130.85', status: 'ok' as const },
  { name: 'NDRE', value: '0.38', valueColor: '#16a34a', range: '0.25\u20130.50', status: 'ok' as const },
  { name: 'NDMI', value: '0.21', valueColor: '#16a34a', range: '0.10\u20130.40', status: 'ok' as const },
  { name: 'NDSI', value: '0.08', valueColor: '#f59e0b', range: '-0.05\u20130.05', status: 'warn' as const },
];

/* ── Capture info ── */

const captureRows = [
  { label: 'Satellite', value: 'Sentinel-2B' },
  { label: 'Capture Date', value: '2025-03-26 10:32 UTC' },
  { label: 'Cloud Cover', value: '8%', valueColor: '#16a34a' },
  { label: 'Processing Level', value: 'L2A (BOA)' },
  { label: 'Tile', value: 'T12UQA' },
];

const captureChips = [
  { label: 'Copernicus', color: '#4338ca', bg: '#e0e7ff' },
  { label: 'ESA', color: '#1d4ed8', bg: '#dbeafe' },
  { label: 'Cloud-free', color: '#16a34a', bg: '#dcfce7' },
];

/* ── Trend bars (12 weeks) ── */

const trendBars = [36, 42, 46, 49, 51, 54, 55, 56, 54, 56, 57, 58];

export function ScoutReportPanel({ onClose }: ScoutReportPanelProps) {
  return (
    <div className="panel">
      <PanelHeader title="CELL B4 \u00b7 SCOUT REPORT" onClose={onClose} />
      <div className="panel__body">
        {/* ── Title ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '20px',
              fontWeight: 400,
              color: '#1f2937',
            }}
          >
            Scout Report
          </span>
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '11px',
              color: 'var(--text-secondary)',
            }}
          >
            Automated analysis from latest satellite pass
          </span>
        </div>

        {/* ── Cell Coordinates (styled section) ── */}
        <div className="styled-section styled-section--gap-8">
          <span className="styled-section__header">CELL COORDINATES</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                padding: '10px',
                borderRadius: '8px',
                background: 'var(--surface-white)',
              }}
            >
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '8px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>LATITUDE</span>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', color: '#1f2937' }}>51.0447&deg;N</span>
            </div>
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                padding: '10px',
                borderRadius: '8px',
                background: 'var(--surface-white)',
              }}
            >
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '8px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>LONGITUDE</span>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', color: '#1f2937' }}>110.6781&deg;W</span>
            </div>
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                padding: '10px',
                borderRadius: '8px',
                background: 'var(--surface-white)',
              }}
            >
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '8px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>CELL ID</span>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', color: '#1f2937' }}>R12-C04</span>
            </div>
          </div>
        </div>

        {/* ── Health Classification (styled section) ── */}
        <div className="styled-section">
          <span className="styled-section__header">HEALTH CLASSIFICATION</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                background: '#dcfce7',
              }}
            >
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '10px', fontWeight: 700, color: '#16a34a', letterSpacing: '0.5px' }}>HEALTHY</span>
            </div>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--text-secondary)' }}>
              Consistent with expected growth at Rosette stage
            </span>
          </div>
          {/* Health bar */}
          <div style={{ display: 'flex', height: '24px', borderRadius: '6px', overflow: 'hidden' }}>
            <div style={{ width: '40px', background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '7px', color: 'white' }}>Critical</span>
            </div>
            <div style={{ width: '50px', background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '7px', color: 'white' }}>Stressed</span>
            </div>
            <div style={{ width: '60px', background: '#eab308', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '7px', color: 'white' }}>Fair</span>
            </div>
            <div style={{ flex: 1, background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '7px', fontWeight: 700, color: 'white' }}>Healthy &bull;</span>
            </div>
            <div style={{ width: '50px', background: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '7px', color: 'white' }}>Vigorous</span>
            </div>
          </div>
        </div>

        {/* ── Spectral Indices (styled table) ── */}
        <div className="styled-section" style={{ padding: 0, gap: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px' }}>
            <span className="styled-section__header">SPECTRAL INDICES</span>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: '9px', color: 'var(--text-secondary)' }}>2025-03-25</span>
          </div>
          <div style={{ display: 'flex', gap: '8px', background: '#f0f2f0', padding: '6px 14px', borderBottom: '1px solid var(--border-light)' }}>
            <span style={{ flex: 1, fontFamily: 'var(--font-body)', fontSize: '8px', fontWeight: 700, color: 'var(--text-muted)' }}>Index</span>
            <span style={{ width: '50px', textAlign: 'right', fontFamily: 'var(--font-body)', fontSize: '8px', fontWeight: 700, color: 'var(--text-muted)' }}>Value</span>
            <span style={{ width: '65px', textAlign: 'right', fontFamily: 'var(--font-body)', fontSize: '8px', fontWeight: 700, color: 'var(--text-muted)' }}>Range</span>
            <span style={{ width: '30px', textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: '8px', fontWeight: 700, color: 'var(--text-muted)' }}>Status</span>
          </div>
          {spectralIndices.map((idx, i) => (
            <div
              key={idx.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                borderLeft: `3px solid ${idx.status === 'ok' ? '#16a34a44' : '#f59e0b44'}`,
                borderRadius: i === spectralIndices.length - 1 ? '0 0 10px 10px' : undefined,
              }}
            >
              <span style={{ flex: 1, fontFamily: 'var(--font-body)', fontSize: '10px', fontWeight: 700, color: '#1f2937' }}>{idx.name}</span>
              <span style={{ width: '50px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 600, color: idx.valueColor }}>{idx.value}</span>
              <span style={{ width: '65px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-secondary)' }}>{idx.range}</span>
              <div style={{ width: '30px', display: 'flex', justifyContent: 'center' }}>
                {idx.status === 'ok'
                  ? <CircleCheck size={14} style={{ color: '#16a34a' }} />
                  : <TriangleAlert size={14} style={{ color: '#f59e0b' }} />
                }
              </div>
            </div>
          ))}
        </div>

        {/* ── NDVI Trend (styled section) ── */}
        <div className="styled-section">
          <span className="styled-section__header">NDVI TREND (12 WEEKS)</span>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: '1px',
              height: '80px',
              borderRadius: '6px',
              background: '#f0fdf4',
            }}
          >
            {trendBars.map((h, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: `${h}px`,
                  borderRadius: '1px',
                  background: i === trendBars.length - 1 ? '#166534' : '#16a34a',
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-muted)' }}>Jan 1</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-muted)' }}>Feb 1</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-muted)' }}>Mar 25</span>
          </div>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '9px', color: 'var(--text-secondary)' }}>
            Steady upward trend — consistent with expected growth curve for Rosette stage canola
          </span>
        </div>

        {/* ── Capture Information (styled section) ── */}
        <div className="styled-section styled-section--gap-8">
          <span className="styled-section__header">CAPTURE INFORMATION</span>
          {captureRows.map((row) => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '9px', color: 'var(--text-secondary)' }}>{row.label}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 600, color: row.valueColor || '#1f2937' }}>{row.value}</span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: '6px' }}>
            {captureChips.map((chip) => (
              <div key={chip.label} style={{ padding: '4px 8px', borderRadius: '4px', background: chip.bg }}>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '8px', color: chip.color }}>{chip.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Timestamp ── */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '8px',
              color: 'var(--text-tertiary)',
            }}
          >
            Generated: 2025-03-27 &middot; NocPulse Scout Engine v2.1
          </span>
        </div>
      </div>
    </div>
  );
}
