'use client';
import { X, MapPin, Crosshair } from 'lucide-react';
import { PanelEmptyState } from '../ui/PanelEmptyState';
import { useAppTheme } from '../layout/WorkspaceShell';

interface SpotInspectorPanelProps { onClose?: () => void; }

export function SpotInspectorPanel({ onClose }: SpotInspectorPanelProps) {
  const isDark = useAppTheme() === 'dark';
  const txt = isDark ? 'rgba(255,255,255,0.78)' : '#1f2937';
  const ok = isDark ? 'rgba(74,222,128,0.85)' : '#16a34a';

  // No cell selected — show empty state
  const hasSelection = false;

  return (
    <div className="fdp" style={{ position: 'absolute', top: 'var(--space-lg)', right: 'var(--space-lg)', bottom: 'var(--space-xl)' }}>
      <div className="fdp__header"><div className="fdp__header-top"><div><h1 className="fdp__field-name">Spot Inspector</h1><p className="fdp__field-meta">Tap a point on the map to inspect</p></div>{onClose && <button type="button" onClick={onClose} style={{ background: 'var(--surface-white)', border: '1px solid var(--border-light)', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0 }}><X size={14} /></button>}</div></div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 16px 16px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, alignContent: 'start' }}>
        {!hasSelection ? (
          <div style={{ gridColumn: '1 / -1' }}>
            <PanelEmptyState icon={Crosshair} title="No spot selected" description="Tap any point on the map to inspect soil moisture, vegetation indices, and change history at that location." />
          </div>
        ) : (
          <>
            <div className="fdp-card fdp-card--span-full" style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <MapPin size={20} style={{ color: ok, flexShrink: 0 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div className="fdp-big fdp-big--18" style={{ color: txt }}>52.1842°N, −110.6398°W</div>
                <div className="fdp-sub">Cell R12-C04 · Canola · Flowering stage</div>
              </div>
            </div>
            <div className="fdp-card"><div className="fdp-lbl">ROOT MOISTURE</div><div className="fdp-big fdp-big--22" style={{ color: ok }}>38.4%</div><div className="fdp-sub">Adequate</div></div>
            <div className="fdp-card"><div className="fdp-lbl">SURFACE</div><div className="fdp-big fdp-big--22" style={{ color: txt }}>22.1%</div><div className="fdp-sub">Below average</div></div>
            <div className="fdp-card"><div className="fdp-lbl">NDVI</div><div className="fdp-big fdp-big--22" style={{ color: ok }}>0.72</div></div>
            <div className="fdp-card"><div className="fdp-lbl">CONFIDENCE</div><div className="fdp-big fdp-big--18" style={{ color: txt }}>High</div></div>
          </>
        )}
      </div>
    </div>
  );
}
