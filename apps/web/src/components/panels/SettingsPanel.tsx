'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Satellite, CloudSun, MapPin, Bell, BellOff, Ruler, Globe, User, Building2 } from 'lucide-react';
import { Card, Lbl, LblM, Big, Sub, Mono } from './fieldDetailCardPrimitives';
import {
  normalizeWorkspaceSettings,
  type WorkspaceSettingsState,
} from '../../features/settings/workspaceSettings';

/* ── Types ── */

export interface SettingsViewer {
  displayName: string;
  email: string | null;
  initials: string;
  workspaceRoleLabel: string;
  workspaceName: string | null;
}

interface SettingsPanelProps {
  onClose?: () => void;
  workspaceId?: string | null;
  viewer?: SettingsViewer | null;
}

function readPersistedSettings(storageKey: string): WorkspaceSettingsState | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<WorkspaceSettingsState>;
    if (!parsed) return null;

    return normalizeWorkspaceSettings(parsed);
  } catch {
    return null;
  }
}

async function readApiResult<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as {
    result?: T;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(payload.error?.message ?? 'Request failed.');
  }

  if (!payload.result) {
    throw new Error('Request completed without a result payload.');
  }

  return payload.result;
}

/* ── Toggle ── */

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        width: 40, height: 22, borderRadius: 999, padding: 2,
        background: checked ? 'var(--primary-green)' : 'var(--border-medium)',
        border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
        transition: 'background 200ms ease', flexShrink: 0,
      }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        transform: checked ? 'translateX(18px)' : 'translateX(0)',
        transition: 'transform 200ms cubic-bezier(.2,.8,.2,1)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
      }} />
    </button>
  );
}

/* ── Segment ── */

function Segment<T extends string>({ options, labels, value, onChange }: {
  options: readonly T[]; labels: string[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div style={{
      display: 'flex', borderRadius: 10, padding: 2, gap: 2,
      background: 'rgba(255,255,255,0.06)',
    }}>
      {options.map((opt, i) => (
        <button key={opt} type="button" onClick={() => onChange(opt)} style={{
          flex: 1, padding: '7px 14px', borderRadius: 8,
          fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: value === opt ? 600 : 400,
          color: value === opt ? '#fff' : 'var(--text-muted)',
          background: value === opt ? 'var(--btn-fill-primary)' : 'transparent',
          border: 'none', cursor: 'pointer', transition: 'all 200ms cubic-bezier(.2,.8,.2,1)',
        }}>{labels[i]}</button>
      ))}
    </div>
  );
}

/* ── Setting Row ── */

function SettingRow({ label, desc, children }: { label: string; desc: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span className="fdp-big fdp-big--14">{label}</span>
        <Sub>{desc}</Sub>
      </div>
      {children}
    </div>
  );
}

/* ── Integration Row ── */

function Integration({ icon: Icon, name, desc, status, color }: {
  icon: typeof Satellite; name: string; desc: string; status: string; color: string;
}) {
  const isConnected = status.toLowerCase() === 'connected';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, background: color,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={18} color="#fff" />
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span className="fdp-big fdp-big--14">{name}</span>
        <Sub>{desc}</Sub>
      </div>
      <Mono color={isConnected ? 'var(--status-positive)' : 'var(--status-warning)'}>{status}</Mono>
    </div>
  );
}

/* ── Component ── */

export function SettingsPanel({ onClose, workspaceId = null, viewer = null }: SettingsPanelProps) {
  const profileName = viewer?.displayName ?? 'John Draper';
  const profileInitials = viewer?.initials ?? 'JD';
  const profileRole = viewer?.workspaceRoleLabel ?? 'Owner';
  const profileWorkspace = viewer?.workspaceName ?? 'Hope Creek Farms';
  const profileEmail = viewer?.email ?? 'john@hopecreek.ca';
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [healthWarnings, setHealthWarnings] = useState(true);
  const [sprayWindows, setSprayWindows] = useState(false);
  const [weeklyDigest, setWeeklyDigest] = useState(true);
  const [units, setUnits] = useState<'metric' | 'imperial'>('metric');
  const [tempUnit, setTempUnit] = useState<'celsius' | 'fahrenheit'>('celsius');
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const hasCompletedInitialLoad = useRef(false);
  const storageKey = useMemo(
    () =>
      workspaceId
        ? `fieldpulse:web:settings:${workspaceId}`
        : 'fieldpulse:web:settings',
    [workspaceId],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      const cached = readPersistedSettings(storageKey);

      try {
        const query = workspaceId
          ? `?workspaceId=${encodeURIComponent(workspaceId)}`
          : '';
        const result = await readApiResult<{ settings: WorkspaceSettingsState }>(
          await fetch(`/api/settings${query}`, {
            cache: 'no-store',
          }),
        );

        if (cancelled) return;

        const next = normalizeWorkspaceSettings(result.settings);
        setEmailAlerts(next.emailAlerts);
        setHealthWarnings(next.healthWarnings);
        setSprayWindows(next.sprayWindows);
        setWeeklyDigest(next.weeklyDigest);
        setUnits(next.units);
        setTempUnit(next.tempUnit);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(storageKey, JSON.stringify(next));
        }
      } catch {
        if (!cached || cancelled) return;

        setEmailAlerts(cached.emailAlerts);
        setHealthWarnings(cached.healthWarnings);
        setSprayWindows(cached.sprayWindows);
        setWeeklyDigest(cached.weeklyDigest);
        setUnits(cached.units);
        setTempUnit(cached.tempUnit);
      } finally {
        if (!cancelled) {
          hasCompletedInitialLoad.current = true;
          setSettingsLoaded(true);
        }
      }
    }

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, [storageKey, workspaceId]);

  useEffect(() => {
    if (!settingsLoaded || !hasCompletedInitialLoad.current || typeof window === 'undefined') {
      return;
    }

    const nextSettings = normalizeWorkspaceSettings({
      emailAlerts,
      healthWarnings,
      sprayWindows,
      weeklyDigest,
      units,
      tempUnit,
    });
    window.localStorage.setItem(storageKey, JSON.stringify(nextSettings));

    const timeout = window.setTimeout(() => {
      void fetch('/api/settings', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          workspaceId: workspaceId ?? undefined,
          settings: nextSettings,
        }),
      }).catch(() => {
        // Keep the UI responsive and preserve the local cache if the network save fails.
      });
    }, 200);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [
    emailAlerts,
    healthWarnings,
    sprayWindows,
    weeklyDigest,
    units,
    tempUnit,
    settingsLoaded,
    storageKey,
    workspaceId,
  ]);

  return (
    <div className="fdp" style={{ position: 'absolute', top: 'var(--space-lg)', right: 'var(--space-lg)', bottom: 'var(--space-xl)' }}>
      {/* ── Header ── */}
      <div className="fdp__header">
        <div className="fdp__header-top">
          <div>
            <h1 className="fdp__field-name">Settings</h1>
            <p className="fdp__field-meta">Workspace preferences & integrations</p>
          </div>
          {onClose && (
            <button type="button" onClick={onClose} style={{
              background: 'var(--surface-white)', border: '1px solid var(--border-light)', borderRadius: '50%',
              width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0, transition: 'all 200ms cubic-bezier(.2,.8,.2,1)',
            }}><X size={14} /></button>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '6px 16px 16px',
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, alignContent: 'start',
      }}>
        {/* ── Profile ── */}
        <Card span={-1}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--color-forest-700), var(--color-forest-900))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 400,
              color: '#fff', flexShrink: 0, letterSpacing: '-0.02em',
            }}>{profileInitials}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
              <Big size={18}>{profileName}</Big>
              <Sub>{profileRole} · {profileWorkspace}</Sub>
            </div>
          </div>
        </Card>

        <Card span={-1}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <User size={14} style={{ color: 'var(--text-muted)' }} />
            <LblM>EMAIL</LblM>
          </div>
          <Mono>{profileEmail}</Mono>
        </Card>

        {/* ── Notifications ── */}
        <Card span={-1} style={{ gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Bell size={14} style={{ color: 'var(--text-muted)' }} />
            <Lbl>NOTIFICATIONS</Lbl>
          </div>
          <SettingRow label="Email Alerts" desc="Critical and high severity findings">
            <Toggle checked={emailAlerts} onChange={setEmailAlerts} />
          </SettingRow>
          <SettingRow label="Health Warnings" desc="Field status changes and NDVI drops">
            <Toggle checked={healthWarnings} onChange={setHealthWarnings} />
          </SettingRow>
          <SettingRow label="Spray Windows" desc="Application timing notifications">
            <Toggle checked={sprayWindows} onChange={setSprayWindows} />
          </SettingRow>
          <SettingRow label="Weekly Digest" desc="Summary email every Monday">
            <Toggle checked={weeklyDigest} onChange={setWeeklyDigest} />
          </SettingRow>
        </Card>

        {/* ── Units ── */}
        <Card span={-1} style={{ gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Ruler size={14} style={{ color: 'var(--text-muted)' }} />
            <Lbl>MEASUREMENT UNITS</Lbl>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Sub>Distance & area</Sub>
            <Segment options={['metric', 'imperial'] as const} labels={['Metric (ha, km)', 'Imperial (ac, mi)']} value={units} onChange={setUnits} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Sub>Temperature</Sub>
            <Segment options={['celsius', 'fahrenheit'] as const} labels={['Celsius (°C)', 'Fahrenheit (°F)']} value={tempUnit} onChange={setTempUnit} />
          </div>
        </Card>

        {/* ── Integrations ── */}
        <Card span={-1} style={{ gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Globe size={14} style={{ color: 'var(--text-muted)' }} />
            <Lbl>DATA INTEGRATIONS</Lbl>
          </div>
          <Integration icon={Satellite} name="Sentinel Hub" desc="Sentinel-1 (SAR) + Sentinel-2 (optical)" status="Connected" color="#004726" />
          <Integration icon={CloudSun} name="Open-Meteo" desc="Weather forecasts + historical ERA5" status="Connected" color="#3b82f6" />
          <Integration icon={MapPin} name="MapQuest" desc="Geocoding + base map tiles" status="Connected" color="#ef4444" />
        </Card>

        {/* ── Footer ── */}
        <div style={{ gridColumn: '1 / -1', textAlign: 'center', paddingTop: 12, borderTop: '1px solid var(--border-light)' }}>
          <Sub>Saved for this workspace{workspaceId ? ` · ${workspaceId}` : ''}</Sub>
        </div>
      </div>
    </div>
  );
}
