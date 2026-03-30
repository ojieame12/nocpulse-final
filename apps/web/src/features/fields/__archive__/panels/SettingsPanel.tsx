'use client';

import { useState } from 'react';
import { Satellite, CloudSun, Hexagon } from 'lucide-react';
import { PanelHeader } from '../../../components/ui/PanelHeader';
import { Toggle } from '../../../components/ui/Toggle';

interface SettingsPanelProps {
  onClose?: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [healthChange, setHealthChange] = useState(true);
  const [sprayWindows, setSprayWindows] = useState(false);
  const [units, setUnits] = useState<'metric' | 'imperial'>('metric');

  return (
    <div className="panel">
      <PanelHeader title="SETTINGS" onClose={onClose} />
      <div className="panel__body settings__body">
        {/* ── Profile ── */}
        <section className="settings__section">
          <span className="settings__section-header">PROFILE</span>

          <div className="settings__profile">
            <div className="settings__avatar">JD</div>
            <div className="settings__profile-info">
              <span className="settings__profile-name">John Draper</span>
              <span className="settings__profile-email">john@draper.farm</span>
            </div>
          </div>
        </section>

        {/* ── Form fields ── */}
        <section className="settings__fields">
          <div className="settings__field">
            <label className="settings__label">DISPLAY NAME</label>
            <input
              className="settings__input"
              type="text"
              defaultValue="John Draper"
            />
          </div>
          <div className="settings__field">
            <label className="settings__label">EMAIL</label>
            <input
              className="settings__input"
              type="email"
              defaultValue="john@draper.farm"
            />
          </div>
          <div className="settings__field">
            <label className="settings__label">FARM</label>
            <input
              className="settings__input"
              type="text"
              defaultValue="Draper Satellite Farm"
            />
          </div>
          <div className="settings__field">
            <label className="settings__label">REGION</label>
            <input
              className="settings__input"
              type="text"
              defaultValue="Central Alberta"
            />
          </div>
        </section>

        {/* ── Notifications ── */}
        <section className="settings__section">
          <span className="settings__section-header">NOTIFICATIONS</span>

          <div className="settings__toggles">
            <div className="settings__toggle-row">
              <div className="settings__toggle-left">
                <span className="settings__toggle-title">Email alerts</span>
                <span className="settings__toggle-desc">
                  NDVI &amp; soil moisture alerts via email
                </span>
              </div>
              <Toggle checked={emailAlerts} onChange={setEmailAlerts} />
            </div>

            <div className="settings__toggle-row">
              <div className="settings__toggle-left">
                <span className="settings__toggle-title">Health change</span>
                <span className="settings__toggle-desc">
                  Notify when health changes significantly
                </span>
              </div>
              <Toggle checked={healthChange} onChange={setHealthChange} />
            </div>

            <div className="settings__toggle-row">
              <div className="settings__toggle-left">
                <span className="settings__toggle-title">Spray windows</span>
                <span className="settings__toggle-desc">
                  Alert when spray and scout windows change
                </span>
              </div>
              <Toggle checked={sprayWindows} onChange={setSprayWindows} />
            </div>
          </div>
        </section>

        {/* ── Units ── */}
        <section className="settings__section">
          <span className="settings__section-header">UNITS</span>

          <div className="settings__segment">
            <button
              type="button"
              className={`settings__segment-item${units === 'metric' ? ' settings__segment-item--active' : ''}`}
              onClick={() => setUnits('metric')}
            >
              Metric
            </button>
            <button
              type="button"
              className={`settings__segment-item${units === 'imperial' ? ' settings__segment-item--active' : ''}`}
              onClick={() => setUnits('imperial')}
            >
              Imperial
            </button>
          </div>
        </section>

        {/* ── Integrations ── */}
        <section className="settings__section">
          <span className="settings__section-header">INTEGRATIONS</span>

          <div className="settings__integrations">
            <div className="settings__integration-row">
              <div className="settings__integration-icon settings__integration-icon--sentinel">
                <Satellite size={16} />
              </div>
              <div className="settings__integration-info">
                <span className="settings__integration-name">Sentinel Hub</span>
                <span className="settings__integration-desc">
                  satellite imagery provider
                </span>
              </div>
            </div>

            <div className="settings__integration-row">
              <div className="settings__integration-icon settings__integration-icon--meteo">
                <CloudSun size={16} />
              </div>
              <div className="settings__integration-info">
                <span className="settings__integration-name">Open-Meteo</span>
                <span className="settings__integration-desc">
                  Met, API &amp; events
                </span>
              </div>
              <span className="settings__integration-badge">Connected</span>
            </div>

            <div className="settings__integration-row settings__integration-row--last">
              <div className="settings__integration-icon settings__integration-icon--reemaj">
                <Hexagon size={16} />
              </div>
              <div className="settings__integration-info">
                <span className="settings__integration-name">Reemaj</span>
                <span className="settings__integration-desc">
                  Field &amp; Drone Intelligence
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Save ── */}
        <button type="button" className="settings__save-btn">
          Save Settings
        </button>
      </div>
    </div>
  );
}
