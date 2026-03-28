'use client';

import { ArrowDown, Crosshair, Clock } from 'lucide-react';
import { Badge, Button, PanelHeader } from '../ui';

interface EvidencePanelProps {
  onClose?: () => void;
}

/* ── NDVI trend captures ── */

const captures = [
  { date: 'Feb 28', ndvi: 0.74, color: 'var(--status-positive)' },
  { date: 'Mar 07', ndvi: 0.72, color: 'var(--status-positive)' },
  { date: 'Mar 14', ndvi: 0.69, color: 'var(--status-positive)' },
  { date: 'Mar 21', ndvi: 0.65, color: 'var(--status-warning)' },
  { date: 'Mar 28', ndvi: 0.60, color: 'var(--status-danger)' },
];

/* ── Inspection targets ── */

const targets = [
  {
    id: 'A',
    label: 'NW corner stress zone',
    coords: '51.0452\u00b0N, 110.6792\u00b0W',
    color: 'var(--status-danger)',
  },
  {
    id: 'B',
    label: 'East drainage edge',
    coords: '51.0451\u00b0N, 113.8757\u00b0W',
    color: 'var(--status-warning)',
  },
];

export function EvidencePanel({ onClose }: EvidencePanelProps) {
  return (
    <div className="panel">
      <PanelHeader title="NDVI DROP EVIDENCE" onClose={onClose} />
      <div className="panel__body" style={{ padding: '32px 32px 16px 32px' }}>
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
            NDVI Drop Evidence
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '11px',
                color: 'var(--text-secondary)',
              }}
            >
              North Quarter A &middot; Zone NW-3
            </span>
            <Badge variant="danger">URGENT</Badge>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '11px',
                color: 'var(--text-muted)',
              }}
            >
              3h ago
            </span>
          </div>
        </div>

        {/* ── Current vs Previous comparison ── */}
        <div className="evidence-metrics">
          {/* Current */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '9px',
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '1px',
              }}
            >
              CURRENT
            </span>
            <span
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '28px',
                color: 'var(--text-primary)',
              }}
            >
              0.60
            </span>
          </div>

          {/* Delta */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ArrowDown size={14} style={{ color: 'var(--status-danger)' }} />
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--status-danger)',
                }}
              >
                -0.12
              </span>
            </div>
          </div>

          {/* Previous */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '9px',
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '1px',
              }}
            >
              PREVIOUS
            </span>
            <span
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '28px',
                color: 'var(--text-primary)',
              }}
            >
              0.72
            </span>
          </div>
        </div>

        {/* ── Image comparison placeholder ── */}
        <div
          style={{
            display: 'flex',
            height: '200px',
            borderRadius: '20px',
            overflow: 'hidden',
            border: '1px solid var(--border-light)',
            position: 'relative',
          }}
        >
          <div style={{ flex: 1, background: '#e8e8e8', position: 'relative' }}>
            <span
              style={{
                position: 'absolute',
                bottom: '10px',
                left: '11px',
                fontFamily: 'var(--font-body)',
                fontSize: '9px',
                fontWeight: 700,
                letterSpacing: '0.8px',
                color: 'var(--color-white)',
                textShadow: '0 1px 2.6px rgba(0,0,0,0.5)',
              }}
            >
              True Color
            </span>
          </div>
          <div style={{ flex: 1, background: '#d4d4d4', position: 'relative' }}>
            <span
              style={{
                position: 'absolute',
                bottom: '10px',
                right: '11px',
                fontFamily: 'var(--font-body)',
                fontSize: '9px',
                fontWeight: 700,
                letterSpacing: '0.8px',
                color: 'var(--color-white)',
                textShadow: '0 1px 2.6px rgba(0,0,0,0.5)',
              }}
            >
              NDVI
            </span>
          </div>
        </div>

        {/* ── NDVI Trend (styled section) ── */}
        <div className="styled-section">
          <span className="styled-section__header">NDVI TREND (5 CAPTURES)</span>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: '2px',
              height: '80px',
              borderRadius: '6px',
              background: '#fef2f2',
              padding: '4px 6px',
            }}
          >
            {captures.map((cap) => (
              <div
                key={cap.date}
                style={{
                  flex: 1,
                  height: `${((cap.ndvi - 0.5) / 0.3) * 100}%`,
                  borderRadius: '4px 4px 0 0',
                  backgroundColor: cap.color,
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            {captures.map((cap) => (
              <span
                key={cap.date}
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '8px',
                  color: 'var(--text-muted)',
                }}
              >
                {cap.date}
              </span>
            ))}
          </div>
        </div>

        {/* ── Inspection Targets (styled section) ── */}
        <div className="styled-section styled-section--gap-8">
          <span className="styled-section__header">INSPECTION TARGETS</span>
          {targets.map((target) => (
            <div
              key={target.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 10px',
                borderRadius: '6px',
                background: 'var(--surface-white)',
              }}
            >
              <div
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: target.color,
                  flexShrink: 0,
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                  }}
                >
                  Target {target.id} &mdash; {target.label}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                  }}
                >
                  {target.coords}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* ── Action buttons (side by side) ── */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <Button variant="panel-primary" icon={Crosshair}>
            Start Inspection
          </Button>
          <Button variant="panel-secondary" icon={Clock}>
            View History
          </Button>
        </div>
      </div>
    </div>
  );
}
