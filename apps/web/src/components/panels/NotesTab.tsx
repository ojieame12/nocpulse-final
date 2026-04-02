'use client';

/* Types + pure helpers preserved from archived NotesTab. Component stub pending redesign. */

import { CircleAlert, CircleX, CircleCheck, Eye } from 'lucide-react';

export type ScoutNoteOutcome = 'confirmed' | 'not_confirmed' | 'resolved' | 'monitor';

export interface FieldNoteHistoryItem {
  id: string; date: string; text: string; status: ScoutNoteOutcome;
  syncStatus?: 'pending' | 'failed';
  findingId?: string | null; zoneId?: string | null; cellKey?: string | null;
}

export interface FieldNotesInspectionTarget {
  dateLabel: string; name: string; coordinateLabel: string;
  findingId?: string | null; zoneId?: string | null; cellKey?: string | null;
}

export interface FieldNotesProps {
  workspaceId: string; fieldId: string; name: string; lld: string;
  inspectionTarget: FieldNotesInspectionTarget | null;
  entries: readonly FieldNoteHistoryItem[];
  submitUrl: string;
}

export interface ScoutNoteOutcomeOption {
  id: ScoutNoteOutcome;
  icon: typeof CircleAlert;
  lightColor: string; darkColor: string;
  title: string; desc: string;
  selectedBorderLight: string | undefined;
  selectedBorderDark: string | undefined;
}

export const SCOUT_NOTE_OUTCOME_OPTIONS: readonly ScoutNoteOutcomeOption[] = [
  { id: 'confirmed', icon: CircleAlert, lightColor: '#ef4444', darkColor: 'rgba(252,165,165,0.85)', title: 'Confirmed', desc: 'Stress or damage is visible in the field', selectedBorderLight: '#ef4444', selectedBorderDark: 'rgba(239,68,68,0.5)' },
  { id: 'not_confirmed', icon: CircleX, lightColor: '#6b7280', darkColor: 'rgba(255,255,255,0.45)', title: 'Not Confirmed', desc: 'Issue not visible from the ground', selectedBorderLight: undefined, selectedBorderDark: undefined },
  { id: 'resolved', icon: CircleCheck, lightColor: '#16a34a', darkColor: 'rgba(134,239,172,0.85)', title: 'Resolved', desc: 'Issue has been addressed', selectedBorderLight: '#16a34a', selectedBorderDark: 'rgba(22,163,74,0.5)' },
  { id: 'monitor', icon: Eye, lightColor: '#f59e0b', darkColor: 'rgba(253,224,71,0.85)', title: 'Monitor', desc: 'Keep watching, not yet actionable', selectedBorderLight: '#f59e0b', selectedBorderDark: 'rgba(245,158,11,0.5)' },
];

export function resolveScoutNoteOutcomeMeta(status: ScoutNoteOutcome, isDark: boolean) {
  switch (status) {
    case 'confirmed': return { label: 'Confirmed', statusColor: isDark ? 'rgba(252,165,165,0.85)' : '#ef4444', badgeBg: isDark ? 'rgba(239,68,68,0.12)' : '#fef2f2' };
    case 'resolved': return { label: 'Resolved', statusColor: isDark ? 'rgba(134,239,172,0.85)' : '#16a34a', badgeBg: isDark ? 'rgba(22,163,74,0.12)' : '#f0fdf4' };
    case 'monitor': return { label: 'Monitor', statusColor: isDark ? 'rgba(253,224,71,0.85)' : '#f59e0b', badgeBg: isDark ? 'rgba(245,158,11,0.12)' : '#fefce8' };
    default: return { label: 'Not Confirmed', statusColor: isDark ? 'rgba(255,255,255,0.45)' : '#6b7280', badgeBg: isDark ? 'rgba(255,255,255,0.06)' : '#f4f4f5' };
  }
}

export function NotesTab(_props: { field?: FieldNotesProps; onClose?: () => void }) {
  return null; // Redesign pending
}
