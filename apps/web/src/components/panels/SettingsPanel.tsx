'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Bell, Ruler, Globe, Satellite, CloudSun, MapPin, Archive, RotateCcw } from 'lucide-react';
import { Card, Lbl, Sub, Mono } from './fieldDetailCardPrimitives';
import {
  normalizeWorkspaceSettings,
  type WorkspaceSettingsState,
} from '../../features/settings/workspaceSettings';
import { canManageWorkspace } from '../../features/settings/workspaceAccess';
import { WorkspaceAccessCard } from './WorkspaceAccessCard';
import { FieldShareCard } from './FieldShareCard';

/* ── Types ── */

export interface SettingsViewer {
  displayName: string;
  email: string | null;
  initials: string;
  workspaceRole?: 'owner' | 'manager' | 'member' | 'viewer';
  workspaceRoleLabel: string;
  workspaceName: string | null;
}

type ArchivedFieldListItem = {
  id: string;
  workspaceId: string;
  name: string;
  areaHa: number;
  legalLandDescription: string | null;
  archivedAt: string;
  archivedBy: string | null;
};

interface SettingsPanelProps {
  onClose?: () => void;
  workspaceId?: string | null;
  viewer?: SettingsViewer | null;
  fieldId?: string | null;
  fieldName?: string | null;
  isOffline?: boolean;
  onArchivedFieldRestored?: (field: {
    id: string;
    workspaceId: string;
    name: string;
    areaHa: number;
    legalLandDescription: string | null;
  }) => void;
}

function readPersistedSettings(storageKey: string): WorkspaceSettingsState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    return normalizeWorkspaceSettings(JSON.parse(raw) as Partial<WorkspaceSettingsState>);
  } catch {
    return null;
  }
}

async function readApiResult<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as { result?: T; error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message ?? 'Request failed.');
  if (!payload.result) throw new Error('Request completed without a result payload.');
  return payload.result;
}

/* ── Toggle ── */

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-label={label}
      className="settings-toggle"
      data-checked={checked}
    >
      <div className="settings-toggle__thumb" />
    </button>
  );
}

/* ── Segment ── */

function Segment<T extends string>({ options, labels, value, onChange }: {
  options: readonly T[]; labels: string[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div className="settings-segment">
      {options.map((opt, i) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`settings-segment__btn${value === opt ? ' settings-segment__btn--active' : ''}`}
        >{labels[i]}</button>
      ))}
    </div>
  );
}

/* ── Setting Row ── */

function SettingRow({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="settings-row">
      <div className="settings-row__text">
        <span className="settings-row__label">{label}</span>
        {desc && <span className="settings-row__desc">{desc}</span>}
      </div>
      {children}
    </div>
  );
}

/* ── Component ── */

export function SettingsPanel({
  onClose,
  workspaceId = null,
  viewer = null,
  fieldId = null,
  fieldName = null,
  isOffline = false,
  onArchivedFieldRestored,
}: SettingsPanelProps) {
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [healthWarnings, setHealthWarnings] = useState(true);
  const [sprayWindows, setSprayWindows] = useState(false);
  const [weeklyDigest, setWeeklyDigest] = useState(true);
  const [units, setUnits] = useState<'metric' | 'imperial'>('metric');
  const [tempUnit, setTempUnit] = useState<'celsius' | 'fahrenheit'>('celsius');
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [archivedFields, setArchivedFields] = useState<ArchivedFieldListItem[]>([]);
  const [archivedFieldsLoaded, setArchivedFieldsLoaded] = useState(false);
  const [archivedFieldsError, setArchivedFieldsError] = useState<string | null>(null);
  const [restorePendingFieldId, setRestorePendingFieldId] = useState<string | null>(null);
  const hasCompletedInitialLoad = useRef(false);
  const storageKey = useMemo(
    () => workspaceId ? `fieldpulse:web:settings:${workspaceId}` : 'fieldpulse:web:settings',
    [workspaceId],
  );
  const canManageArchivedFields = !!workspaceId && !!viewer?.workspaceRole && canManageWorkspace(viewer.workspaceRole);

  // Load settings
  useEffect(() => {
    let cancelled = false;
    async function loadSettings() {
      const cached = readPersistedSettings(storageKey);
      try {
        const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';
        const result = await readApiResult<{ settings: WorkspaceSettingsState }>(
          await fetch(`/api/settings${query}`, { cache: 'no-store' }),
        );
        if (cancelled) return;
        const next = normalizeWorkspaceSettings(result.settings);
        setEmailAlerts(next.emailAlerts); setHealthWarnings(next.healthWarnings);
        setSprayWindows(next.sprayWindows); setWeeklyDigest(next.weeklyDigest);
        setUnits(next.units); setTempUnit(next.tempUnit);
        if (typeof window !== 'undefined') window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        if (!cached || cancelled) return;
        setEmailAlerts(cached.emailAlerts); setHealthWarnings(cached.healthWarnings);
        setSprayWindows(cached.sprayWindows); setWeeklyDigest(cached.weeklyDigest);
        setUnits(cached.units); setTempUnit(cached.tempUnit);
      } finally {
        if (!cancelled) { hasCompletedInitialLoad.current = true; setSettingsLoaded(true); }
      }
    }
    void loadSettings();
    return () => { cancelled = true; };
  }, [storageKey, workspaceId]);

  // Load archived fields
  useEffect(() => {
    let cancelled = false;
    if (!canManageArchivedFields || !workspaceId) {
      setArchivedFields([]); setArchivedFieldsLoaded(false); setArchivedFieldsError(null); return;
    }
    async function loadArchivedFields() {
      try {
        const result = await readApiResult<{ fields: ArchivedFieldListItem[] }>(
          await fetch(`/api/fields?status=archived&workspaceId=${encodeURIComponent(workspaceId!)}`, {
            cache: 'no-store', headers: { 'x-fieldpulse-workspace-id': workspaceId! },
          }),
        );
        if (cancelled) return;
        setArchivedFields(result.fields); setArchivedFieldsError(null);
      } catch (error) {
        if (cancelled) return;
        setArchivedFieldsError(error instanceof Error ? error.message : 'Unable to load archived fields.');
      } finally {
        if (!cancelled) setArchivedFieldsLoaded(true);
      }
    }
    void loadArchivedFields();
    return () => { cancelled = true; };
  }, [canManageArchivedFields, workspaceId]);

  // Save settings
  useEffect(() => {
    if (!settingsLoaded || !hasCompletedInitialLoad.current || typeof window === 'undefined') return;
    const next = normalizeWorkspaceSettings({ emailAlerts, healthWarnings, sprayWindows, weeklyDigest, units, tempUnit });
    window.localStorage.setItem(storageKey, JSON.stringify(next));
    const timeout = window.setTimeout(() => {
      void fetch('/api/settings', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workspaceId: workspaceId ?? undefined, settings: next }),
      }).catch(() => {});
    }, 200);
    return () => window.clearTimeout(timeout);
  }, [emailAlerts, healthWarnings, sprayWindows, weeklyDigest, units, tempUnit, settingsLoaded, storageKey, workspaceId]);

  async function handleRestoreField(field: ArchivedFieldListItem) {
    if (!canManageArchivedFields || restorePendingFieldId || isOffline) return;
    setRestorePendingFieldId(field.id);
    try {
      const result = await readApiResult<{ field: { id: string; workspaceId: string; name: string; areaHa: number; legalLandDescription: string | null } }>(
        await fetch(`/api/fields/${field.id}/restore`, { method: 'POST', headers: { 'x-fieldpulse-workspace-id': field.workspaceId } }),
      );
      setArchivedFields((c) => c.filter((e) => e.id !== field.id));
      setArchivedFieldsError(null);
      onArchivedFieldRestored?.(result.field);
    } catch (error) {
      setArchivedFieldsError(error instanceof Error ? error.message : 'Unable to restore this field.');
    } finally {
      setRestorePendingFieldId(null);
    }
  }

  return (
    <div className="fdp">
      {/* Header */}
      <div className="fdp__header">
        <div className="fdp__header-top">
          <h1 className="fdp__field-name">Settings</h1>
          {onClose && (
            <button type="button" className="fdp__close" onClick={onClose} aria-label="Close">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="fdp__body">

        {/* Profile */}
        <Card span={-1}>
          <div className="settings-profile">
            <div className="settings-profile__avatar">
              {viewer?.initials ?? 'NP'}
            </div>
            <div className="settings-profile__info">
              <span className="settings-profile__name">{viewer?.displayName ?? 'NocPulse User'}</span>
              <Mono>{viewer?.email ?? '—'}</Mono>
              <Sub>{viewer?.workspaceRoleLabel ?? 'Member'} · {viewer?.workspaceName ?? 'Workspace'}</Sub>
            </div>
          </div>
        </Card>

        {/* Share + Access */}
        <FieldShareCard workspaceId={workspaceId} fieldId={fieldId} fieldName={fieldName} />
        <WorkspaceAccessCard workspaceId={workspaceId} />

        {/* Notifications */}
        <Card span={-1}>
          <div className="settings-section-header">
            <Bell size={13} />
            <Lbl>NOTIFICATIONS</Lbl>
          </div>
          <SettingRow label="Email alerts" desc="Critical findings"><Toggle checked={emailAlerts} onChange={setEmailAlerts} label="Email alerts" /></SettingRow>
          <SettingRow label="Health warnings" desc="Status changes"><Toggle checked={healthWarnings} onChange={setHealthWarnings} label="Health warnings" /></SettingRow>
          <SettingRow label="Spray windows" desc="Application timing"><Toggle checked={sprayWindows} onChange={setSprayWindows} label="Spray windows" /></SettingRow>
          <SettingRow label="Weekly digest" desc="Monday summary"><Toggle checked={weeklyDigest} onChange={setWeeklyDigest} label="Weekly digest" /></SettingRow>
        </Card>

        {/* Units */}
        <Card span={-1}>
          <div className="settings-section-header">
            <Ruler size={13} />
            <Lbl>UNITS</Lbl>
          </div>
          <SettingRow label="Distance & area">
            <Segment options={['metric', 'imperial'] as const} labels={['Metric', 'Imperial']} value={units} onChange={setUnits} />
          </SettingRow>
          <SettingRow label="Temperature">
            <Segment options={['celsius', 'fahrenheit'] as const} labels={['°C', '°F']} value={tempUnit} onChange={setTempUnit} />
          </SettingRow>
        </Card>

        {/* Integrations */}
        <Card span={-1}>
          <div className="settings-section-header">
            <Globe size={13} />
            <Lbl>DATA SOURCES</Lbl>
          </div>
          {[
            { icon: Satellite, name: 'Sentinel Hub', sub: 'SAR + Optical', color: '#004726' },
            { icon: CloudSun, name: 'Open-Meteo', sub: 'Weather + ERA5', color: '#3b82f6' },
            { icon: MapPin, name: 'MapTiler', sub: 'Base maps', color: '#ef4444' },
          ].map((s) => (
            <div key={s.name} className="settings-integration">
              <div className="settings-integration__icon" style={{ background: s.color }}>
                <s.icon size={14} color="#fff" />
              </div>
              <div className="settings-integration__text">
                <span className="settings-row__label">{s.name}</span>
                <Sub>{s.sub}</Sub>
              </div>
              <Mono color="var(--status-positive)">Active</Mono>
            </div>
          ))}
        </Card>

        {/* Archived Fields */}
        {canManageArchivedFields && (
          <Card span={-1}>
            <div className="settings-section-header">
              <Archive size={13} />
              <Lbl>ARCHIVED FIELDS</Lbl>
            </div>
            {!archivedFieldsLoaded ? <Sub>Loading…</Sub>
              : archivedFieldsError ? <Sub>{archivedFieldsError}</Sub>
              : archivedFields.length === 0 ? <Sub>No archived fields</Sub>
              : archivedFields.map((field) => (
                <div key={field.id} className="settings-archived-field">
                  <div>
                    <span className="settings-row__label">{field.name}</span>
                    <Sub>{field.areaHa.toFixed(1)} ha{field.legalLandDescription ? ` · ${field.legalLandDescription}` : ''}</Sub>
                  </div>
                  <button
                    type="button"
                    className="settings-restore-btn"
                    onClick={() => void handleRestoreField(field)}
                    disabled={restorePendingFieldId === field.id || isOffline}
                  >
                    <RotateCcw size={11} />
                    {restorePendingFieldId === field.id ? 'Restoring…' : 'Restore'}
                  </button>
                </div>
              ))}
          </Card>
        )}

        {/* Footer */}
        <div className="settings-footer">
          <Sub>NocPulse · Agricultural Intelligence</Sub>
        </div>
      </div>
    </div>
  );
}
