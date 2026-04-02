'use client';
import { X, TrendingDown } from 'lucide-react';
import { useAppTheme } from '../layout/WorkspaceShell';

interface EvidencePanelProps { onClose?: () => void; }

export function EvidencePanel({ onClose }: EvidencePanelProps) {
  const isDark = useAppTheme() === 'dark';
  const txt = isDark ? 'rgba(255,255,255,0.78)' : '#1f2937';
  const danger = isDark ? 'rgba(252,165,165,0.85)' : '#dc2626';
  const ok = isDark ? 'rgba(74,222,128,0.85)' : '#16a34a';
  const bars = [72, 71, 70, 68, 65];

  return (
    <div className="fdp" style={{ position: 'absolute', top: 'var(--space-lg)', right: 'var(--space-lg)', bottom: 'var(--space-xl)' }}>
      <div className="fdp__header"><div className="fdp__header-top"><div><h1 className="fdp__field-name">Evidence</h1><p className="fdp__field-meta">Crop-health decline analysis · Zone NW-3</p></div>{onClose && <button type="button" onClick={onClose} style={{ background: 'var(--surface-white)', border: '1px solid var(--border-light)', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0 }}><X size={14} /></button>}</div></div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 16px 16px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, alignContent: 'start' }}>
        <div className="fdp-card fdp-card--span-full" style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
          <TrendingDown size={24} style={{ color: danger, flexShrink: 0 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div className="fdp-big fdp-big--18" style={{ color: txt }}>Crop-Health Drop Detected</div>
            <div className="fdp-sub">North Quarter A · Zone NW-3 · 4 cells affected</div>
          </div>
        </div>
        <div className="fdp-card"><div className="fdp-lbl">CURRENT</div><div className="fdp-big fdp-big--28" style={{ color: danger }}>0.65</div><div className="fdp-sub">Latest capture</div></div>
        <div className="fdp-card"><div className="fdp-lbl">PREVIOUS</div><div className="fdp-big fdp-big--28" style={{ color: ok }}>0.72</div><div className="fdp-sub">Prior capture</div></div>
        <div className="fdp-card fdp-card--span-full" style={{ gap: 8 }}>
          <div className="fdp-lbl">DELTA</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <div className="fdp-big fdp-big--22" style={{ color: danger }}>−9.7%</div>
            <div className="fdp-sub">decline over 12 days</div>
          </div>
          <div className="fdp-prog" style={{ height: 4, background: `${danger}18` }}><div className="fdp-prog__fill" style={{ width: '70%', background: danger }} /></div>
        </div>
        <div className="fdp-card fdp-card--span-full" style={{ gap: 8 }}>
          <div className="fdp-lbl">CROP-HEALTH TREND (5 CAPTURES)</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80 }}>
            {bars.map((h, i) => (<div key={i} style={{ flex: 1, height: `${h}%`, borderRadius: 3, background: i === bars.length - 1 ? danger : ok, opacity: i === bars.length - 1 ? 1 : 0.6 }} />))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="fdp-mono" style={{ fontSize: 8, color: 'var(--text-muted)' }}>Feb 10</span><span className="fdp-mono" style={{ fontSize: 8, color: 'var(--text-muted)' }}>Mar 26</span></div>
        </div>
        <div className="fdp-card fdp-card--span-full" style={{ gap: 6 }}>
          <div className="fdp-lbl">EVIDENCE DETAIL</div>
          {[{ k: 'Detection', v: 'Automated crop-health comparison' }, { k: 'Affected cells', v: '4 (R12-C04 through R12-C07)' }, { k: 'Confidence', v: 'High — clear pass, no cloud' }, { k: 'Recommended', v: 'Scout east section within 48h' }].map(d => (
            <div key={d.k} style={{ display: 'flex', justifyContent: 'space-between' }}><span className="fdp-sub">{d.k}</span><span className="fdp-mono" style={{ color: txt }}>{d.v}</span></div>
          ))}
        </div>
        <div style={{ gridColumn: '1 / -1', textAlign: 'center', paddingTop: 8, borderTop: '1px solid var(--border-light)', fontSize: 8, color: 'var(--text-tertiary)' }}>Evidence generated from Sentinel-2 pass Mar 26, 2025</div>
      </div>
    </div>
  );
}
