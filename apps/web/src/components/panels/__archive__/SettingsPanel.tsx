'use client';

import { useState } from 'react';
import { Satellite, CloudSun, MapPin } from 'lucide-react';
import { Button, PanelHeader, Toggle } from '../ui';
import { useAppTheme } from '../layout/WorkspaceShell';

interface SettingsPanelProps {
  onClose?: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const theme = useAppTheme();
  const isDark = theme === 'dark';
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [healthWarnings, setHealthWarnings] = useState(true);
  const [sprayWindows, setSprayWindows] = useState(false);
  const [units, setUnits] = useState<'metric' | 'imperial'>('metric');

  return (
    <div className="panel">
      <PanelHeader title="SETTINGS" onClose={onClose} />
      <div className="panel__body" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>

        {/* ──────────────────────────────────────────────────
            Profile Card (span-full)
            ────────────────────────────────────────────────── */}
        <div className="fdp-card fdp-card--span-full">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
            {/* Avatar circle */}
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'var(--primary-green)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-body)',
                fontSize: '16px',
                fontWeight: 700,
                color: 'var(--color-white)',
                flexShrink: 0,
              }}
            >
              JD
            </div>
            {/* Name + role */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
              <div className="fdp-big--18">John Draper</div>
              <div className="fdp-sub">Owner · Draper Family Farm</div>
            </div>
          </div>

          {/* Profile mini-grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '8px',
              paddingTop: '8px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div className="fdp-lbl" style={{ color: 'var(--text-tertiary)' }}>Display Name</div>
              <div className="fdp-mono">John Draper</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div className="fdp-lbl" style={{ color: 'var(--text-tertiary)' }}>Email</div>
              <div className="fdp-mono">john@draper.farm</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div className="fdp-lbl" style={{ color: 'var(--text-tertiary)' }}>Farm</div>
              <div className="fdp-mono">Draper Family Farm</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div className="fdp-lbl" style={{ color: 'var(--text-tertiary)' }}>Region</div>
              <div className="fdp-mono">Central Alberta</div>
            </div>
          </div>
        </div>

        {/* ──────────────────────────────────────────────────
            Notifications Card (span-full)
            ────────────────────────────────────────────────── */}
        <div className="fdp-card fdp-card--span-full">
          <div className="fdp-lbl" style={{ color: 'var(--text-tertiary)', paddingBottom: '4px' }}>
            NOTIFICATIONS
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Email Alerts row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                  }}
                >
                  Email Alerts
                </div>
                <div className="fdp-sub">Receive field status alerts via email</div>
              </div>
              <Toggle checked={emailAlerts} onChange={setEmailAlerts} />
            </div>

            {/* Health Warnings row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                  }}
                >
                  Health Warnings
                </div>
                <div className="fdp-sub">Push notifications for health changes, stage changes</div>
              </div>
              <Toggle checked={healthWarnings} onChange={setHealthWarnings} />
            </div>

            {/* Spray Windows row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                  }}
                >
                  Spray Windows
                </div>
                <div className="fdp-sub">Alert when spray conditions change</div>
              </div>
              <Toggle checked={sprayWindows} onChange={setSprayWindows} />
            </div>
          </div>
        </div>

        {/* ──────────────────────────────────────────────────
            Units Card (span-full)
            ────────────────────────────────────────────────── */}
        <div className="fdp-card fdp-card--span-full">
          <div className="fdp-lbl" style={{ color: 'var(--text-tertiary)', paddingBottom: '4px' }}>
            UNITS
          </div>

          <div className="segment-toggle">
            <button
              type="button"
              className={`segment-toggle__item${units === 'metric' ? ' segment-toggle__item--active' : ''}`}
              onClick={() => setUnits('metric')}
            >
              Metric
            </button>
            <button
              type="button"
              className={`segment-toggle__item${units === 'imperial' ? ' segment-toggle__item--active' : ''}`}
              onClick={() => setUnits('imperial')}
            >
              Imperial
            </button>
          </div>

          <div className="fdp-sub">Affects all measurements across the app.</div>
        </div>

        {/* ──────────────────────────────────────────────────
            Integrations — 3-column grid
            ────────────────────────────────────────────────── */}
        {/* Sentinel Hub */}
        <div className="fdp-card">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '8px',
                background: 'rgba(78, 166, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#4ea6ff',
              }}
            >
              <Satellite size={20} />
            </div>
            <div className="fdp-lbl" style={{ color: 'var(--text-primary)', fontSize: '11px' }}>
              Sentinel Hub
            </div>
            <div className="fdp-sub" style={{ textAlign: 'center', fontSize: '10px' }}>
              3 active imaging pipelines
            </div>
            <div style={{ color: isDark ? 'rgba(74, 222, 128, 0.85)' : '#16a34a', fontSize: '10px', fontWeight: 700 }}>Connected</div>
          </div>
        </div>

        {/* Open-Meteo */}
        <div className="fdp-card">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '8px',
                background: isDark ? 'rgba(251, 191, 36, 0.15)' : 'rgba(251, 191, 36, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fbbf24',
              }}
            >
              <CloudSun size={20} />
            </div>
            <div className="fdp-lbl" style={{ color: 'var(--text-primary)', fontSize: '11px' }}>
              Open-Meteo
            </div>
            <div className="fdp-sub" style={{ textAlign: 'center', fontSize: '10px' }}>
              Weather data source
            </div>
            <div style={{ color: isDark ? 'rgba(74, 222, 128, 0.85)' : '#16a34a', fontSize: '10px', fontWeight: 700 }}>Connected</div>
          </div>
        </div>

        {/* Mapquest */}
        <div className="fdp-card">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '8px',
                background: 'rgba(229, 115, 115, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#e57373',
              }}
            >
              <MapPin size={20} />
            </div>
            <div className="fdp-lbl" style={{ color: 'var(--text-primary)', fontSize: '11px' }}>
              Mapquest
            </div>
            <div className="fdp-sub" style={{ textAlign: 'center', fontSize: '10px' }}>
              Trial Discovery provider
            </div>
            <div style={{ color: isDark ? 'rgba(252, 211, 77, 0.85)' : 'var(--status-warning)', fontSize: '10px', fontWeight: 700 }}>
              14 days left
            </div>
          </div>
        </div>

        {/* ──────────────────────────────────────────────────
            Save Button (span-full)
            ────────────────────────────────────────────────── */}
        <div style={{ gridColumn: '1 / -1' }}>
          <Button variant="panel-primary">Save settings</Button>
        </div>
      </div>
    </div>
  );
}
