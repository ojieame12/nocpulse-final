'use client';

import { AlertTriangle, ArrowLeft, X } from 'lucide-react';
import { Card, Lbl, LblM, Big, Sub, Mono } from './fieldDetailCardPrimitives';
import { PanelEmptyState } from '../ui/PanelEmptyState';
import { useAppTheme } from '../layout/WorkspaceShell';

/* ── Types ── */

type ZoneSeverity = 'low' | 'medium' | 'high' | 'critical' | null;
type ZoneStatus = 'healthy' | 'stressed' | 'critical';

export interface ZoneDetailPanelZone {
  id: string; family: string; trackingKey: string; status: string;
  severity: ZoneSeverity; affectedCellCount: number; detectionCount: number; lastSeenAt: string;
}

export interface ZoneDetailPanelCell {
  id: string; rootZonePct: number; surfacePct: number; confidence: 'low' | 'medium' | 'high';
}

export interface ZoneDetailPanelFinding {
  id: string; title: string; summary: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical'; startedAt: string;
}

interface ZoneDetailPanelProps {
  zone?: ZoneDetailPanelZone | null;
  cells?: readonly ZoneDetailPanelCell[];
  findings?: readonly ZoneDetailPanelFinding[];
  contextLabel?: string;
  showHeader?: boolean;
  onClose?: () => void;
}

/* ── Helpers ── */

function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}
function familyLabel(f: string): string { return f.replace(/_/g, ' '); }
function avg(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((s, v) => s + v, 0) / values.length;
}
function rootStatus(pct: number): ZoneStatus {
  if (pct < 25) return 'critical';
  if (pct < 40) return 'stressed';
  return 'healthy';
}

function sevColor(s: ZoneSeverity | ZoneStatus, isDark: boolean): string {
  if (s === 'critical' || s === 'high') return isDark ? 'rgba(252,165,165,0.85)' : '#dc2626';
  if (s === 'stressed' || s === 'medium') return isDark ? 'rgba(252,211,77,0.85)' : '#d97706';
  if (s === 'healthy' || s === 'low') return isDark ? 'rgba(74,222,128,0.85)' : '#16a34a';
  return 'var(--text-muted)';
}
function sevBg(s: string, isDark: boolean): string {
  if (s === 'critical' || s === 'high') return isDark ? 'rgba(239,68,68,0.1)' : '#fef2f2';
  if (s === 'stressed' || s === 'medium') return isDark ? 'rgba(245,158,11,0.1)' : '#fef3c7';
  if (s === 'healthy' || s === 'low') return isDark ? 'rgba(22,163,74,0.1)' : '#f0fdf4';
  return 'var(--color-slate-50)';
}

/* ── HeroDonut ── */

function HeroDonut({ value, color }: { value: number; color: string }) {
  const size = 120;
  const sw = 4.5;
  const r = (size - sw) / 2;
  const ci = 2 * Math.PI * r;
  const safe = Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : 0;
  return (
    <svg width={size} height={size} style={{ display: 'block', flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw} opacity={0.12} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw}
        strokeDasharray={ci} strokeDashoffset={ci * (1 - safe)} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(.4,0,.2,1)' }} />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
        style={{ fontFamily: 'var(--font-heading)', fontSize: 28, fontWeight: 400, fill: 'var(--text-primary)' }}>
        {(safe * 100).toFixed(0)}%
      </text>
    </svg>
  );
}

/* ── Component ── */

export function ZoneDetailPanel({ zone, cells, findings, contextLabel, showHeader = true, onClose }: ZoneDetailPanelProps) {
  const theme = useAppTheme();
  const isDark = theme === 'dark';

  if (!zone) {
    const empty = <PanelEmptyState icon={AlertTriangle} title="No tracked zone selected"
      description="Choose a tracked zone to view real detections, findings, and cell evidence." />;
    if (!showHeader) return empty;
    return (
      <div className="fdp" style={{ position: 'absolute', top: 'var(--space-lg)', right: 'var(--space-lg)', bottom: 'var(--space-xl)' }}>
        <div className="fdp__header">
          <div className="fdp__header-top">
            <h1 className="fdp__field-name">Zone Detail</h1>
            {onClose && <CloseBtn onClick={onClose} />}
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{empty}</div>
      </div>
    );
  }

  const activeCells = cells ?? [];
  const activeFindings = findings ?? [];
  const avgRoot = avg(activeCells.map(c => c.rootZonePct));
  const avgSurf = avg(activeCells.map(c => c.surfacePct));
  const hiConf = activeCells.filter(c => c.confidence === 'high').length;
  const status = zone.severity ? (zone.severity === 'critical' || zone.severity === 'high' ? 'critical' : zone.severity === 'medium' ? 'stressed' : 'healthy') as ZoneStatus : rootStatus(avgRoot);
  const heroColor = sevColor(status, isDark);
  const surfColor = isDark ? 'rgba(147,197,253,0.85)' : '#3b82f6';

  const content = (
    <>
      {/* ── Hero: Donut + Identity ── */}
      <Card span={-1} style={{ flexDirection: 'row', gap: 24, alignItems: 'flex-start', padding: '16px 18px' }}>
        <HeroDonut value={avgRoot / 100} color={heroColor} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Big size={18}>{familyLabel(zone.family)} · {zone.trackingKey}</Big>
          <span className="fdp-mono" style={{
            fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
            textTransform: 'uppercase', background: sevBg(status, isDark), color: heroColor,
            width: 'fit-content',
          }}>{zone.status}</span>
          <Sub>{zone.affectedCellCount} cells · {zone.detectionCount} detections</Sub>
        </div>
      </Card>

      {/* ── 4-col Metrics ── */}
      <div className="fdp__vitals-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <Card><LblM>Mapped Cells</LblM><Big size={22}>{zone.affectedCellCount}</Big></Card>
        <Card><LblM>Avg Root</LblM><Big size={22} color={heroColor}>{avgRoot.toFixed(1)}%</Big></Card>
        <Card><LblM>Avg Surface</LblM><Big size={22} color={surfColor}>{avgSurf.toFixed(1)}%</Big></Card>
        <Card><LblM>Confidence</LblM><Big size={18}>{hiConf}/{activeCells.length}</Big></Card>
      </div>

      {/* ── Cell Breakdown ── */}
      {activeCells.length > 0 && (
        <Card span={-1} style={{ gap: 12 }}>
          <LblM>CELL BREAKDOWN</LblM>
          {activeCells.map(cell => {
            const cs = rootStatus(cell.rootZonePct);
            const cc = sevColor(cs, isDark);
            return (
              <div key={cell.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Mono>{cell.id}</Mono>
                  <span style={{ fontSize: 11, fontWeight: 600, color: cc }}>{cell.rootZonePct.toFixed(1)}%</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="fdp-mono" style={{
                    fontSize: 8, fontWeight: 700, padding: '2px 4px', borderRadius: 4,
                    textTransform: 'uppercase', letterSpacing: '0.3px',
                    background: cell.confidence === 'high' ? (isDark ? 'rgba(74,222,128,0.1)' : 'rgba(22,163,74,0.1)') : (isDark ? 'rgba(252,211,77,0.1)' : 'rgba(217,119,6,0.1)'),
                    color: cell.confidence === 'high' ? sevColor('healthy', isDark) : sevColor('stressed', isDark),
                  }}>{cell.confidence}</span>
                  <div className="fdp-prog" style={{ flex: 1, height: 4, background: `${cc}18` }}>
                    <div className="fdp-prog__fill" style={{ width: `${cell.rootZonePct}%`, background: cc }} />
                  </div>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {/* ── Active Findings ── */}
      {activeFindings.length > 0 && (
        <>
          <div style={{ gridColumn: '1 / -1' }}><LblM>LINKED FINDINGS</LblM></div>
          {activeFindings.map(f => {
            const fc = sevColor(f.severity, isDark);
            return (
              <Card key={f.id} span={-1} accent={fc} style={{ gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <AlertTriangle size={14} style={{ color: fc, flexShrink: 0, marginTop: 2 }} />
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', flex: 1 }}>{f.title}</span>
                </div>
                {f.summary && <Sub>{f.summary}</Sub>}
                <Mono>{fmtTime(f.startedAt)}</Mono>
              </Card>
            );
          })}
        </>
      )}

      {/* ── Evidence Summary ── */}
      <Card span={-1}>
        <LblM>Zone Evidence</LblM>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { k: 'Affected cells', v: String(zone.affectedCellCount) },
            { k: 'Detections', v: String(zone.detectionCount) },
            { k: 'Last seen', v: fmtTime(zone.lastSeenAt) },
            { k: 'Linked findings', v: activeFindings.length > 0 ? activeFindings.map(f => f.title).join(' · ') : 'None linked' },
            { k: 'Family', v: familyLabel(zone.family) },
          ].map(d => (
            <div key={d.k} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Sub>{d.k}</Sub><Mono>{d.v}</Mono>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Footer timestamp ── */}
      <div style={{ gridColumn: '1 / -1', textAlign: 'center', fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-body)', paddingTop: 8, borderTop: '1px solid var(--border-light)' }}>
        Last updated: {fmtTime(zone.lastSeenAt)}
      </div>
    </>
  );

  if (!showHeader) return <>{content}</>;

  return (
    <div className="fdp" style={{ position: 'absolute', top: 'var(--space-lg)', right: 'var(--space-lg)', bottom: 'var(--space-xl)' }}>
      <div className="fdp__header">
        <div className="fdp__header-top">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {onClose && (
              <button type="button" onClick={onClose} className="fdp__back-btn" style={{
                width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--surface-white)', border: '1px solid var(--border-light)', cursor: 'pointer', color: 'var(--text-muted)',
                transition: 'all 200ms cubic-bezier(.2,.8,.2,1)', flexShrink: 0,
              }}><ArrowLeft size={14} /></button>
            )}
            <div>
              <h1 className="fdp__field-name">Zone Detail</h1>
              <p className="fdp__field-meta">{familyLabel(zone.family)} · {zone.trackingKey}</p>
            </div>
          </div>
          {onClose && <CloseBtn onClick={onClose} />}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 16px 16px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, alignContent: 'start' }}>
        {content}
      </div>
    </div>
  );
}

function CloseBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{
      background: 'var(--surface-white)', border: '1px solid var(--border-light)', borderRadius: '50%',
      width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0, transition: 'all 200ms cubic-bezier(.2,.8,.2,1)',
    }}><X size={14} /></button>
  );
}
