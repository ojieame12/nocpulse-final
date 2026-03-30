'use client';

import { useState } from 'react';
import { Satellite, CloudSun, MapPin } from 'lucide-react';
import { Card, Lbl, LblM, Big, Sub, Mono } from './fieldDetailCardPrimitives';
import { PanelHeader } from '../ui/PanelHeader';
import { Toggle } from '../ui/Toggle';

/* ── Types ── */

interface SettingsPanelProps {
  onClose?: () => void;
}

/* ── Static config (wire to API later) ── */

const INTEGRATIONS = [
  { name: 'Sentinel Hub', desc: 'Optical + SAR imagery', icon: Satellite, status: 'Connected', color: '#004726' },
  { name: 'Open-Meteo', desc: 'Weather + forecast', icon: CloudSun, status: 'Connected', color: '#3b82f6' },
  { name: 'MapQuest', desc: 'Geocoding + basemap', icon: MapPin, status: 'Connected', color: '#ef4444' },
] as const;

/* ── Component ── */

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [healthWarnings, setHealthWarnings] = useState(true);
  const [sprayWindows, setSprayWindows] = useState(false);
  const [units, setUnits] = useState<'metric' | 'imperial'>('metric');
  const [tempUnit, setTempUnit] = useState<'celsius' | 'fahrenheit'>('celsius');

  return (
    <div className="fdp" style={{ position: 'absolute', top: 'var(--space-lg)', right: 'var(--space-lg)', bottom: 'var(--space-xl)' }}>
      <PanelHeader title="SETTINGS" onClose={onClose} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', alignContent: 'start' }}>

        {/* ── Profile ── */}
        <Card span={-1}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'var(--primary-green)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-body)', fontSize: 16, fontWeight: 700,
              color: '#fff', flexShrink: 0,
            }}>
              JD
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Big size={18}>John Draper</Big>
              <Sub>Owner · Hope Creek Farms</Sub>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <LblM>DISPLAY NAME</LblM>
              <Mono>John Draper</Mono>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <LblM>EMAIL</LblM>
              <Mono>john@hopecreek.ca</Mono>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <LblM>FARM</LblM>
              <Mono>Hope Creek Farms</Mono>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <LblM>REGION</LblM>
              <Mono>Saskatchewan, CA</Mono>
            </div>
          </div>
        </Card>

        {/* ── Notifications ── */}
        <Card span={-1}>
          <Lbl>NOTIFICATIONS</Lbl>
          <ToggleRow label="Email Alerts" desc="Critical and high severity" checked={emailAlerts} onChange={setEmailAlerts} />
          <ToggleRow label="Health Warnings" desc="Field status changes" checked={healthWarnings} onChange={setHealthWarnings} />
          <ToggleRow label="Spray Windows" desc="Application timing" checked={sprayWindows} onChange={setSprayWindows} />
        </Card>

        {/* ── Units ── */}
        <Card span={-1}>
          <Lbl>UNITS</Lbl>
          <SegmentToggle options={['metric', 'imperial'] as const} labels={['Metric', 'Imperial']} value={units} onChange={setUnits} />
          <SegmentToggle options={['celsius', 'fahrenheit'] as const} labels={['Celsius', 'Fahrenheit']} value={tempUnit} onChange={setTempUnit} />
        </Card>

        {/* ── Integrations ── */}
        <Card span={-1} style={{ gap: 8 }}>
          <Lbl>INTEGRATIONS</Lbl>
          {INTEGRATIONS.map((int) => (
            <div key={int.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: int.color, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <int.icon size={18} color="#fff" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {int.name}
                  </span>
                  <Sub>{int.desc}</Sub>
                </div>
              </div>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 700, color: 'var(--status-positive)' }}>
                {int.status}
              </span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{label}</span>
        <Sub>{desc}</Sub>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

function SegmentToggle<T extends string>({ options, labels, value, onChange }: { options: readonly T[]; labels: string[]; value: T; onChange: (v: T) => void }) {
  return (
    <div style={{ display: 'flex', borderRadius: 'var(--radius-full)', background: 'var(--color-slate-50)', padding: 2, gap: 2 }}>
      {options.map((opt, i) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          style={{
            flex: 1, padding: '6px 16px', borderRadius: 'var(--radius-full)',
            fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: value === opt ? 600 : 400,
            color: value === opt ? '#fff' : 'var(--text-secondary)',
            background: value === opt ? 'var(--btn-fill-primary)' : 'transparent',
            border: 'none', cursor: 'pointer',
            transition: 'all 200ms cubic-bezier(.2,.8,.2,1)',
          }}
        >
          {labels[i]}
        </button>
      ))}
    </div>
  );
}
