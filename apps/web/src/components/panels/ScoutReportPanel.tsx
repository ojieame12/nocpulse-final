'use client';
import { X, CircleCheck, TriangleAlert } from 'lucide-react';
import { useAppTheme } from '../layout/WorkspaceShell';

interface ScoutReportPanelProps { onClose?: () => void; }
const indices = [
  { name: 'NDVI', value: '0.72', range: '0.55–0.85', status: 'ok' as const },
  { name: 'NDRE', value: '0.38', range: '0.25–0.50', status: 'ok' as const },
  { name: 'NDMI', value: '0.21', range: '0.10–0.40', status: 'ok' as const },
  { name: 'NDSI', value: '0.08', range: '-0.05–0.05', status: 'warn' as const },
];
const captures = [
  { k: 'Satellite', v: 'Sentinel-2B' }, { k: 'Captured', v: '2025-03-26 10:32 UTC' },
  { k: 'Cloud Cover', v: '8%' }, { k: 'Processing', v: 'L2A (BOA)' }, { k: 'Tile', v: 'T12UQA' },
];
const bars = [36, 42, 46, 49, 51, 54, 55, 56, 54, 56, 57, 58];

export function ScoutReportPanel({ onClose }: ScoutReportPanelProps) {
  const isDark = useAppTheme() === 'dark';
  const ok = isDark ? 'rgba(74,222,128,0.85)' : '#16a34a';
  const warn = isDark ? 'rgba(252,211,77,0.85)' : '#f59e0b';
  const txt = isDark ? 'rgba(255,255,255,0.78)' : '#1f2937';
  const barBg = isDark ? 'rgba(22,163,74,0.12)' : '#f0fdf4';
  const badgeBg = isDark ? 'rgba(22,163,74,0.15)' : '#dcfce7';

  return (
    <div className="fdp" style={{ position: 'absolute', top: 'var(--space-lg)', right: 'var(--space-lg)', bottom: 'var(--space-xl)' }}>
      <div className="fdp__header"><div className="fdp__header-top"><div><h1 className="fdp__field-name">Scout Report</h1><p className="fdp__field-meta">Cell B4 · Automated satellite analysis</p></div>{onClose && <button type="button" onClick={onClose} style={{ background: 'var(--surface-white)', border: '1px solid var(--border-light)', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0 }}><X size={14} /></button>}</div></div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 16px 16px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, alignContent: 'start' }}>
        {[{ l: 'LATITUDE', v: '51.0447°N' }, { l: 'LONGITUDE', v: '110.6781°W' }, { l: 'CELL ID', v: 'R12-C04' }].map(c => (
          <div key={c.l} className="fdp-card"><div className="fdp-lbl">{c.l}</div><div className="fdp-big fdp-big--16" style={{ color: txt }}>{c.v}</div></div>
        ))}
        <div className="fdp-card"><div className="fdp-lbl">STATUS</div><span style={{ padding: '4px 10px', borderRadius: 6, background: badgeBg, fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: 700, color: ok, width: 'fit-content' }}>HEALTHY</span></div>
        <div className="fdp-card fdp-card--span-full" style={{ gap: 8 }}>
          <div className="fdp-lbl">HEALTH CLASSIFICATION</div>
          <div className="fdp-sub">Consistent with expected growth at Rosette stage</div>
          <div style={{ display: 'flex', height: 20, borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ width: '15%', background: isDark ? 'rgba(252,165,165,0.7)' : '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 7, color: isDark ? 'rgba(0,0,0,0.8)' : '#fff' }}>Critical</span></div>
            <div style={{ width: '20%', background: isDark ? 'rgba(252,211,77,0.7)' : '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 7, color: isDark ? 'rgba(0,0,0,0.8)' : '#fff' }}>Stressed</span></div>
            <div style={{ flex: 1, background: isDark ? 'rgba(74,222,128,0.7)' : '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 7, fontWeight: 700, color: isDark ? 'rgba(0,0,0,0.8)' : '#fff' }}>Healthy •</span></div>
            <div style={{ width: '18%', background: isDark ? 'rgba(22,101,52,0.85)' : '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 7, color: '#fff' }}>Vigorous</span></div>
          </div>
        </div>
        {indices.map(idx => { const c = idx.status === 'ok' ? ok : warn; return (
          <div key={idx.name} className="fdp-card fdp-card--accent" style={{ borderLeft: `3px solid ${c}`, gap: 6 }}>
            <div className="fdp-lbl">{idx.name}</div><div className="fdp-big fdp-big--22" style={{ color: c }}>{idx.value}</div><div className="fdp-sub">{idx.range}</div>
            <div className="fdp-prog" style={{ height: 4, background: `${c}18` }}><div className="fdp-prog__fill" style={{ width: '70%', background: c }} /></div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>{idx.status === 'ok' ? <CircleCheck size={14} style={{ color: ok }} /> : <TriangleAlert size={14} style={{ color: warn }} />}</div>
          </div>
        ); })}
        <div className="fdp-card fdp-card--span-full" style={{ gap: 8 }}>
          <div className="fdp-lbl">NDVI TREND (12 WEEKS)</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 80, borderRadius: 6, background: barBg, padding: 4 }}>
            {bars.map((h, i) => (<div key={i} style={{ flex: 1, height: h, borderRadius: 1, background: i === bars.length - 1 ? (isDark ? 'rgba(22,101,52,0.85)' : '#166534') : (isDark ? 'rgba(22,163,74,0.7)' : '#16a34a') }} />))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="fdp-mono" style={{ fontSize: 8, color: 'var(--text-muted)' }}>Jan 1</span><span className="fdp-mono" style={{ fontSize: 8, color: 'var(--text-muted)' }}>Mar 25</span></div>
          <div className="fdp-sub">Steady upward trend — consistent with expected growth curve</div>
        </div>
        <div className="fdp-card fdp-card--span-full" style={{ gap: 8 }}>
          <div className="fdp-lbl">CAPTURE INFORMATION</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{captures.map(r => (<div key={r.k} style={{ display: 'flex', justifyContent: 'space-between' }}><span className="fdp-sub">{r.k}</span><span className="fdp-mono" style={{ color: txt }}>{r.v}</span></div>))}</div>
          <div style={{ display: 'flex', gap: 6, paddingTop: 4 }}>{['Copernicus', 'ESA', 'Cloud-free'].map(c => (<span key={c} className="fdp__chip" style={{ fontSize: 8 }}>{c}</span>))}</div>
        </div>
        <div style={{ gridColumn: '1 / -1', textAlign: 'center', paddingTop: 8, borderTop: '1px solid var(--border-light)', fontSize: 8, color: 'var(--text-tertiary)' }}>Generated: 2025-03-27 · NocPulse Scout Engine v2.1</div>
      </div>
    </div>
  );
}
