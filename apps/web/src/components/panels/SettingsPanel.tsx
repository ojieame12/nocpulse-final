'use client';

import { useState } from 'react';
import { Satellite, CloudSun, MapPin } from 'lucide-react';
import { Button, PanelHeader, Toggle } from '../ui';

interface SettingsPanelProps {
  onClose?: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [healthWarnings, setHealthWarnings] = useState(true);
  const [sprayWindows, setSprayWindows] = useState(false);
  const [units, setUnits] = useState<'metric' | 'imperial'>('metric');

  return (
    <div className="panel">
      <PanelHeader title="SETTINGS" onClose={onClose} />
      <div className="panel__body panel__body--gap-20">
        {/* ── Profile ── */}
        <span className="styled-section__header">PROFILE</span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 0' }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                fontWeight: 700,
                color: 'var(--text-primary)',
              }}
            >
              John Draper
            </span>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '12px',
                color: 'var(--text-muted)',
              }}
            >
              John Draper, Owner
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="settings-field">
            <span className="settings-field__label">Display Name</span>
            <span className="settings-field__value">John Draper</span>
          </div>
          <div className="settings-field">
            <span className="settings-field__label">Email</span>
            <span className="settings-field__value">john@draper.farm</span>
          </div>
          <div className="settings-field">
            <span className="settings-field__label">Farm</span>
            <span className="settings-field__value">Draper Family Farm</span>
          </div>
          <div className="settings-field">
            <span className="settings-field__label">Region</span>
            <span className="settings-field__value">Central Alberta</span>
          </div>
        </div>

        {/* ── Notifications ── */}
        <span className="styled-section__header">NOTIFICATIONS</span>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="settings-toggle-row">
            <div className="settings-toggle-row__left">
              <span className="settings-toggle-row__title">Email Alerts</span>
              <span className="settings-toggle-row__desc">
                Receive field status alerts via email
              </span>
            </div>
            <Toggle checked={emailAlerts} onChange={setEmailAlerts} />
          </div>
          <div className="settings-toggle-row">
            <div className="settings-toggle-row__left">
              <span className="settings-toggle-row__title">Health Warnings</span>
              <span className="settings-toggle-row__desc">
                Push notifications for health changes, stage changes
              </span>
            </div>
            <Toggle checked={healthWarnings} onChange={setHealthWarnings} />
          </div>
          <div className="settings-toggle-row">
            <div className="settings-toggle-row__left">
              <span className="settings-toggle-row__title">Spray Windows</span>
              <span className="settings-toggle-row__desc">
                Alert when spray conditions change
              </span>
            </div>
            <Toggle checked={sprayWindows} onChange={setSprayWindows} />
          </div>
        </div>

        {/* ── Units ── */}
        <span className="styled-section__header">UNITS</span>

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

        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '11px',
            color: 'var(--text-tertiary)',
          }}
        >
          Affects all measurements across the app.
        </span>

        {/* ── Integrations ── */}
        <span className="styled-section__header">INTEGRATIONS</span>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div className="integration-card">
            <div className="integration-row__icon integration-row__icon--sentinel">
              <Satellite size={18} />
            </div>
            <div className="integration-row__info">
              <span className="integration-row__name">Sentinel Hub</span>
              <span className="integration-row__desc">
                3 active imaging pipelines
              </span>
            </div>
            <span className="integration-row__status integration-row__status--connected">
              Connected
            </span>
          </div>

          <div className="integration-card integration-card--active">
            <div className="integration-row__icon integration-row__icon--open-meteo">
              <CloudSun size={18} />
            </div>
            <div className="integration-row__info">
              <span className="integration-row__name">Open-Meteo</span>
              <span className="integration-row__desc">Weather data source</span>
            </div>
            <span className="integration-row__status integration-row__status--connected">
              Connected
            </span>
          </div>

          <div className="integration-card">
            <div className="integration-row__icon integration-row__icon--mapquest">
              <MapPin size={18} />
            </div>
            <div className="integration-row__info">
              <span className="integration-row__name">Mapquest</span>
              <span className="integration-row__desc">
                Trial Discovery provider
              </span>
            </div>
            <span className="integration-row__status" style={{ color: 'var(--status-warning)' }}>
              14 days left
            </span>
          </div>
        </div>

        {/* ── Save ── */}
        <Button variant="panel-primary">Save settings</Button>
      </div>
    </div>
  );
}
