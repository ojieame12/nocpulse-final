'use client';

import type { LucideIcon } from 'lucide-react';
import {
  ListChecks,
  NotebookPen,
  Bell,
  Sprout,
  Settings,
  ClipboardList,
  ScanSearch,
  Crosshair,
  PlusCircle,
} from 'lucide-react';
import { PanelHeader } from '../ui/PanelHeader';

interface PanelPlaceholderProps {
  title: string;
  icon: LucideIcon;
  description: string;
  onClose?: () => void;
}

function PanelPlaceholder({ title, icon: Icon, description, onClose }: PanelPlaceholderProps) {
  return (
    <div className="panel">
      <PanelHeader title={title} onClose={onClose} />
      <div className="panel__body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 16, padding: '48px 32px', textAlign: 'center' }}>
        <Icon size={40} strokeWidth={1.5} style={{ color: 'var(--border-medium)' }} />
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
          {title}
        </span>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, maxWidth: 220, margin: 0 }}>
          {description}
        </p>
      </div>
    </div>
  );
}

/* ── Stub exports matching archived panel signatures ── */

export function ActionTab({ onClose }: { field?: unknown; onClose?: () => void } = {}) {
  return <PanelPlaceholder title="ACTION" icon={ListChecks} description="Action panel is being redesigned with proper field context and recommendations." onClose={onClose} />;
}
export type FieldActionProps = Record<string, unknown>;

export function NotesTab({ onClose }: { field?: unknown; onClose?: () => void } = {}) {
  return <PanelPlaceholder title="NOTES" icon={NotebookPen} description="Notes panel is being redesigned with scout report context and field history." onClose={onClose} />;
}
export type FieldNotesProps = Record<string, unknown>;

export function AlertsPanel({ onClose, ...rest }: Record<string, unknown> & { onClose?: () => void }) {
  return <PanelPlaceholder title="ALERTS" icon={Bell} description="Alerts panel is being redesigned with proper severity triage and zone context." onClose={onClose} />;
}
export type AlertsPanelProps = Record<string, unknown>;
export type AlertItem = Record<string, unknown>;
export type ResolvedAlertItem = Record<string, unknown>;

export function CropsPanel({ onClose }: { onClose?: () => void } = {}) {
  return <PanelPlaceholder title="CROPS" icon={Sprout} description="Crops panel is being redesigned with growth stage tracking and yield context." onClose={onClose} />;
}

export function SettingsPanel({ onClose }: { onClose?: () => void } = {}) {
  return <PanelPlaceholder title="SETTINGS" icon={Settings} description="Settings panel is being redesigned with workspace and notification preferences." onClose={onClose} />;
}

export function ScoutReportPanel({ onClose }: { onClose?: () => void } = {}) {
  return <PanelPlaceholder title="SCOUT REPORT" icon={ClipboardList} description="Scout report panel is being redesigned with field inspection context." onClose={onClose} />;
}

export function EvidencePanel({ onClose }: { onClose?: () => void } = {}) {
  return <PanelPlaceholder title="EVIDENCE" icon={ScanSearch} description="Evidence panel is being redesigned with satellite comparison and change detection." onClose={onClose} />;
}

export function SpotInspectorPanel({ onClose }: { onClose?: () => void } = {}) {
  return <PanelPlaceholder title="SPOT INSPECTOR" icon={Crosshair} description="Spot inspector is being redesigned with cell-level data inspection." onClose={onClose} />;
}

export function AddFieldPanel({ onClose }: { onClose?: () => void } = {}) {
  return <PanelPlaceholder title="ADD FIELD" icon={PlusCircle} description="Field intake is being redesigned with LLD lookup and boundary import." onClose={onClose} />;
}
