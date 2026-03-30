'use client';

import { CircleCheck, TriangleAlert } from 'lucide-react';
import { PanelHeader } from '../ui';
import { useAppTheme } from '../layout/WorkspaceShell';

interface ScoutReportPanelProps {
  onClose?: () => void;
}

/* ── Spectral indices data ── */

const spectralIndices = [
  { name: 'NDVI', value: '0.72', lightColor: '#16a34a', darkColor: 'rgba(74, 222, 128, 0.85)', range: '0.55–0.85', status: 'ok' as const },
  { name: 'NDRE', value: '0.38', lightColor: '#16a34a', darkColor: 'rgba(74, 222, 128, 0.85)', range: '0.25–0.50', status: 'ok' as const },
  { name: 'NDMI', value: '0.21', lightColor: '#16a34a', darkColor: 'rgba(74, 222, 128, 0.85)', range: '0.10–0.40', status: 'ok' as const },
  { name: 'NDSI', value: '0.08', lightColor: '#f59e0b', darkColor: 'rgba(252, 211, 77, 0.85)', range: '-0.05–0.05', status: 'warn' as const },
];

/* ── Capture info ── */

const captureRows = [
  { label: 'Satellite', value: 'Sentinel-2B' },
  { label: 'Capture Date', value: '2025-03-26 10:32 UTC' },
  { label: 'Cloud Cover', value: '8%' },
  { label: 'Processing Level', value: 'L2A (BOA)' },
  { label: 'Tile', value: 'T12UQA' },
];

const captureChips = [
  { label: 'Copernicus' },
  { label: 'ESA' },
  { label: 'Cloud-free' },
];

/* ── Trend bars (12 weeks) ── */

const trendBars = [36, 42, 46, 49, 51, 54, 55, 56, 54, 56, 57, 58];

export function ScoutReportPanel({ onClose }: ScoutReportPanelProps) {
  const theme = useAppTheme();
  const isDark = theme === 'dark';
  const textPrimary = isDark ? 'rgba(255, 255, 255, 0.78)' : '#1f2937';
  const okColor = isDark ? 'rgba(74, 222, 128, 0.85)' : '#16a34a';
  const warnColor = isDark ? 'rgba(252, 211, 77, 0.85)' : '#f59e0b';
  const healthyBadgeBg = isDark ? 'rgba(22, 163, 74, 0.15)' : '#dcfce7';
  const healthyBadgeText = isDark ? 'rgba(74, 222, 128, 0.85)' : '#16a34a';
  const trendBarBg = isDark ? 'rgba(22, 163, 74, 0.12)' : '#f0fdf4';
  const cardBg = isDark ? 'rgba(255, 255, 255, 0.04)' : '#ffffff';
  const gridGap = '8px';

  return (
    <div className="panel">
      <PanelHeader title="CELL B4 · SCOUT REPORT" onClose={onClose} />
      <div className="panel__body">
        {/* Grid container: 4 columns × gap 8px */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: gridGap }}>

          {/* 1. Title card (span-full) */}
          <div
            className="fdp-card fdp-card--span-full"
            style={{ background: cardBg }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div className="fdp-big fdp-big--20" style={{ color: textPrimary }}>
                Scout Report
              </div>
              <div className="fdp-sub">
                Automated analysis from latest satellite pass
              </div>
            </div>
          </div>

          {/* 2. Coordinate cards (3 cards) */}
          <div className="fdp-card" style={{ background: cardBg }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div className="fdp-lbl">LATITUDE</div>
              <div className="fdp-big fdp-big--16" style={{ color: textPrimary }}>
                51.0447°N
              </div>
            </div>
          </div>

          <div className="fdp-card" style={{ background: cardBg }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div className="fdp-lbl">LONGITUDE</div>
              <div className="fdp-big fdp-big--16" style={{ color: textPrimary }}>
                110.6781°W
              </div>
            </div>
          </div>

          <div className="fdp-card" style={{ background: cardBg }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div className="fdp-lbl">CELL ID</div>
              <div className="fdp-big fdp-big--16" style={{ color: textPrimary }}>
                R12-C04
              </div>
            </div>
          </div>

          {/* 3. Health classification card (span-full) */}
          <div
            className="fdp-card fdp-card--span-full"
            style={{ background: cardBg, gap: '8px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  background: healthyBadgeBg,
                }}
              >
                <span style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '10px',
                  fontWeight: 700,
                  color: healthyBadgeText,
                  letterSpacing: '0.5px',
                }}>
                  HEALTHY
                </span>
              </div>
              <span style={{
                fontFamily: 'var(--font-body)',
                fontSize: '10px',
                color: 'var(--text-secondary)',
              }}>
                Consistent with expected growth at Rosette stage
              </span>
            </div>
            {/* Health bar */}
            <div style={{ display: 'flex', height: '24px', borderRadius: '6px', overflow: 'hidden' }}>
              <div style={{ width: '40px', background: isDark ? 'rgba(252, 165, 165, 0.7)' : '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '7px', color: isDark ? 'rgba(0,0,0,0.8)' : 'white' }}>Critical</span>
              </div>
              <div style={{ width: '50px', background: isDark ? 'rgba(252, 211, 77, 0.7)' : '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '7px', color: isDark ? 'rgba(0,0,0,0.8)' : 'white' }}>Stressed</span>
              </div>
              <div style={{ width: '60px', background: isDark ? 'rgba(252, 211, 77, 0.55)' : '#eab308', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '7px', color: isDark ? 'rgba(0,0,0,0.8)' : 'white' }}>Fair</span>
              </div>
              <div style={{ flex: 1, background: isDark ? 'rgba(74, 222, 128, 0.7)' : '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '7px', fontWeight: 700, color: isDark ? 'rgba(0,0,0,0.8)' : 'white' }}>Healthy •</span>
              </div>
              <div style={{ width: '50px', background: isDark ? 'rgba(22, 101, 52, 0.85)' : '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '7px', color: isDark ? 'rgba(255,255,255,0.85)' : 'white' }}>Vigorous</span>
              </div>
            </div>
          </div>

          {/* 4. Spectral indices — 4 cards */}
          {spectralIndices.map((idx) => {
            const color = idx.status === 'ok' ? okColor : warnColor;
            return (
              <div
                key={idx.name}
                className="fdp-card fdp-card--accent"
                style={{
                  background: cardBg,
                  borderLeft: `3px solid ${color}`,
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div className="fdp-lbl">{idx.name}</div>
                  <div className="fdp-big fdp-big--22" style={{ color }}>
                    {idx.value}
                  </div>
                  <div className="fdp-sub">{idx.range}</div>
                  <div className="fdp-prog" style={{ height: '4px', background: `${color}18` }}>
                    <div
                      className="fdp-prog__fill"
                      style={{ width: '70%', background: color }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '4px' }}>
                    {idx.status === 'ok'
                      ? <CircleCheck size={14} style={{ color: okColor }} />
                      : <TriangleAlert size={14} style={{ color: warnColor }} />
                    }
                  </div>
                </div>
              </div>
            );
          })}

          {/* 5. NDVI Trend card (span-full) */}
          <div
            className="fdp-card fdp-card--span-full"
            style={{ background: cardBg, gap: '8px' }}
          >
            <div className="fdp-lbl">NDVI TREND (12 WEEKS)</div>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: '1px',
                height: '80px',
                borderRadius: '6px',
                background: trendBarBg,
                padding: '4px',
              }}
            >
              {trendBars.map((h, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: `${h}px`,
                    borderRadius: '1px',
                    background: i === trendBars.length - 1
                      ? (isDark ? 'rgba(22, 101, 52, 0.85)' : '#166534')
                      : (isDark ? 'rgba(22, 163, 74, 0.7)' : '#16a34a'),
                  }}
                />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="fdp-mono" style={{ fontSize: '8px', color: 'var(--text-muted)' }}>Jan 1</span>
              <span className="fdp-mono" style={{ fontSize: '8px', color: 'var(--text-muted)' }}>Feb 1</span>
              <span className="fdp-mono" style={{ fontSize: '8px', color: 'var(--text-muted)' }}>Mar 25</span>
            </div>
            <div className="fdp-sub">
              Steady upward trend — consistent with expected growth curve for Rosette stage canola
            </div>
          </div>

          {/* 6. Capture info card (span-full) */}
          <div
            className="fdp-card fdp-card--span-full"
            style={{ background: cardBg, gap: '8px' }}
          >
            <div className="fdp-lbl">CAPTURE INFORMATION</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {captureRows.map((row) => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="fdp-lbl">{row.label}</span>
                  <span className="fdp-mono" style={{ color: textPrimary }}>{row.value}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '6px', paddingTop: '4px' }}>
              {captureChips.map((chip) => (
                <div key={chip.label} style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  background: isDark ? 'rgba(79, 70, 229, 0.15)' : '#e0e7ff',
                }}>
                  <span style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '8px',
                    color: isDark ? 'rgba(165, 148, 249, 0.85)' : '#4f46e5',
                  }}>
                    {chip.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Timestamp footer */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0', marginTop: '4px' }}>
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '8px',
              color: 'var(--text-tertiary)',
            }}
          >
            Generated: 2025-03-27 · NocPulse Scout Engine v2.1
          </span>
        </div>
      </div>
    </div>
  );
}
