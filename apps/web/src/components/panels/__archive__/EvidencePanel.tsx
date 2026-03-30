'use client';

import { ArrowDown, Crosshair, Clock } from 'lucide-react';
import { Button, PanelHeader } from '../ui';
import { useAppTheme } from '../layout/WorkspaceShell';

interface EvidencePanelProps {
  onClose?: () => void;
}

/* ── NDVI trend captures ── */

const captures = [
  { date: 'Feb 28', ndvi: 0.74, color: '#16a34a' },
  { date: 'Mar 07', ndvi: 0.72, color: '#16a34a' },
  { date: 'Mar 14', ndvi: 0.69, color: '#16a34a' },
  { date: 'Mar 21', ndvi: 0.65, color: '#f59e0b' },
  { date: 'Mar 28', ndvi: 0.60, color: '#ef4444' },
];

/* ── Inspection targets ── */

const targets = [
  {
    id: 'A',
    label: 'NW corner stress zone',
    coords: '51.0452°N, 110.6792°W',
    color: '#ef4444',
  },
  {
    id: 'B',
    label: 'East drainage edge',
    coords: '51.0451°N, 113.8757°W',
    color: '#f59e0b',
  },
];

export function EvidencePanel({ onClose }: EvidencePanelProps) {
  const theme = useAppTheme();
  const isDark = theme === 'dark';
  const textPrimary = isDark ? 'rgba(255, 255, 255, 0.78)' : '#1f2937';
  const trendBg = isDark ? 'rgba(239, 68, 68, 0.08)' : '#fef2f2';
  const imagePlaceholderA = isDark ? 'rgba(255, 255, 255, 0.06)' : '#e8e8e8';
  const imagePlaceholderB = isDark ? 'rgba(255, 255, 255, 0.04)' : '#d4d4d4';
  const cardBg = isDark ? 'rgba(255, 255, 255, 0.04)' : '#ffffff';
  const gridGap = '8px';
  const dangerColor = '#ef4444';

  return (
    <div className="panel">
      <PanelHeader title="NDVI DROP EVIDENCE" onClose={onClose} />
      <div className="panel__body">
        {/* Grid container: 4 columns × gap 8px */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: gridGap }}>

          {/* 1. Title section (span-full card) */}
          <div
            className="fdp-card fdp-card--span-full"
            style={{ background: cardBg, gap: '6px' }}
          >
            <div className="fdp-big fdp-big--20" style={{ color: textPrimary }}>
              NDVI Drop Evidence
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="fdp-sub">North Quarter A · Zone NW-3</span>
              <div
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  background: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
                }}
              >
                <span style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '10px',
                  fontWeight: 600,
                  color: dangerColor,
                  letterSpacing: '0.5px',
                }}>
                  URGENT
                </span>
              </div>
              <span style={{
                fontFamily: 'var(--font-body)',
                fontSize: '10px',
                color: 'var(--text-muted)',
              }}>
                3h ago
              </span>
            </div>
          </div>

          {/* 2. Comparison cards (3 cards) */}
          <div className="fdp-card" style={{ background: cardBg }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
              <div className="fdp-lbl">CURRENT</div>
              <div className="fdp-big fdp-big--28" style={{ color: textPrimary }}>
                0.60
              </div>
            </div>
          </div>

          <div className="fdp-card" style={{ background: cardBg }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
              <div className="fdp-lbl">DELTA</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ArrowDown size={16} style={{ color: dangerColor }} />
                <span className="fdp-big fdp-big--22" style={{ color: dangerColor }}>
                  -0.12
                </span>
              </div>
            </div>
          </div>

          <div className="fdp-card" style={{ background: cardBg }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
              <div className="fdp-lbl">PREVIOUS</div>
              <div className="fdp-big fdp-big--28" style={{ color: textPrimary }}>
                0.72
              </div>
            </div>
          </div>

          {/* 3. Image comparison (span-full card) */}
          <div
            className="fdp-card fdp-card--span-full"
            style={{
              background: cardBg,
              display: 'flex',
              height: '200px',
              borderRadius: '14px',
              overflow: 'hidden',
              border: '1px solid var(--border-light)',
              padding: 0,
              gap: 0,
            }}
          >
            <div style={{
              flex: 1,
              background: imagePlaceholderA,
              position: 'relative',
              display: 'flex',
              alignItems: 'flex-end',
              padding: '12px',
            }}>
              <span style={{
                fontFamily: 'var(--font-body)',
                fontSize: '9px',
                fontWeight: 700,
                letterSpacing: '0.8px',
                color: 'var(--color-white)',
                textShadow: '0 1px 2.6px rgba(0,0,0,0.5)',
              }}>
                True Color
              </span>
            </div>
            <div style={{
              flex: 1,
              background: imagePlaceholderB,
              position: 'relative',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'flex-end',
              padding: '12px',
            }}>
              <span style={{
                fontFamily: 'var(--font-body)',
                fontSize: '9px',
                fontWeight: 700,
                letterSpacing: '0.8px',
                color: 'var(--color-white)',
                textShadow: '0 1px 2.6px rgba(0,0,0,0.5)',
              }}>
                NDVI
              </span>
            </div>
          </div>

          {/* 4. NDVI Trend card (span-full) */}
          <div
            className="fdp-card fdp-card--span-full"
            style={{ background: cardBg, gap: '8px' }}
          >
            <div className="fdp-lbl">NDVI TREND (5 CAPTURES)</div>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: '2px',
                height: '80px',
                borderRadius: '6px',
                background: trendBg,
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
                  className="fdp-mono"
                  style={{
                    fontSize: '8px',
                    color: 'var(--text-muted)',
                  }}
                >
                  {cap.date}
                </span>
              ))}
            </div>
          </div>

          {/* 5. Inspection Targets — each as a card */}
          {targets.map((target) => (
            <div
              key={target.id}
              className="fdp-card fdp-card--span-2"
              style={{ background: cardBg }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: target.color,
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                  <div className="fdp-lbl">{`Target ${target.id}`}</div>
                  <div className="fdp-big fdp-big--16" style={{ color: textPrimary, wordBreak: 'break-word' }}>
                    {target.label}
                  </div>
                  <div className="fdp-mono" style={{ fontSize: '8px', color: 'var(--text-muted)' }}>
                    {target.coords}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* 6. Action buttons (span-full) */}
          <div
            style={{
              gridColumn: '1 / -1',
              display: 'flex',
              gap: '8px',
            }}
          >
            <Button variant="panel-primary" icon={Crosshair}>
              Start Inspection
            </Button>
            <Button variant="panel-secondary" icon={Clock}>
              View History
            </Button>
          </div>

        </div>
      </div>
    </div>
  );
}
