'use client';

import { useEffect, useMemo, useState } from 'react';
import { Send, CircleAlert, CircleX, CircleCheck, Eye } from 'lucide-react';
import { Button } from '../ui/Button';
import { useAppTheme } from '../layout/WorkspaceShell';

export type ScoutNoteOutcome =
  | 'confirmed'
  | 'not_confirmed'
  | 'resolved'
  | 'monitor';

export interface FieldNoteHistoryItem {
  id: string;
  date: string;
  text: string;
  status: ScoutNoteOutcome;
  findingId?: string | null;
  zoneId?: string | null;
  cellKey?: string | null;
}

export interface FieldNotesInspectionTarget {
  dateLabel: string;
  name: string;
  coordinateLabel: string;
  findingId?: string | null;
  zoneId?: string | null;
  cellKey?: string | null;
}

export interface FieldNotesProps {
  fieldId: string;
  name: string;
  lld: string;
  inspectionTarget: FieldNotesInspectionTarget | null;
  entries: readonly FieldNoteHistoryItem[];
  submitUrl: string;
}

export interface ScoutNoteOutcomeOption {
  id: ScoutNoteOutcome;
  icon: typeof CircleAlert;
  lightColor: string;
  darkColor: string;
  title: string;
  desc: string;
  selectedBorderLight: string | undefined;
  selectedBorderDark: string | undefined;
}

export const SCOUT_NOTE_OUTCOME_OPTIONS: readonly ScoutNoteOutcomeOption[] = [
  {
    id: 'confirmed',
    icon: CircleAlert,
    lightColor: '#ef4444',
    darkColor: 'rgba(252, 165, 165, 0.85)',
    title: 'Confirmed',
    desc: 'Stress or damage is visible in the field',
    selectedBorderLight: '#ef4444',
    selectedBorderDark: 'rgba(239, 68, 68, 0.5)',
  },
  {
    id: 'not_confirmed',
    icon: CircleX,
    lightColor: '#6b7280',
    darkColor: 'rgba(255, 255, 255, 0.45)',
    title: 'Not Confirmed',
    desc: 'Issue not visible from the ground',
    selectedBorderLight: undefined,
    selectedBorderDark: undefined,
  },
  {
    id: 'resolved',
    icon: CircleCheck,
    lightColor: '#16a34a',
    darkColor: 'rgba(74, 222, 128, 0.85)',
    title: 'Resolved',
    desc: 'Issue was present but has been managed',
    selectedBorderLight: '#16a34a',
    selectedBorderDark: 'rgba(22, 163, 74, 0.5)',
  },
  {
    id: 'monitor',
    icon: Eye,
    lightColor: '#f59e0b',
    darkColor: 'rgba(252, 211, 77, 0.85)',
    title: 'Monitor',
    desc: 'Inconclusive. Check again on next capture',
    selectedBorderLight: '#f59e0b',
    selectedBorderDark: 'rgba(245, 158, 11, 0.5)',
  },
] as const;

function formatHistoryDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function resolveScoutNoteOutcomeMeta(status: ScoutNoteOutcome, isDark: boolean) {
  switch (status) {
    case 'confirmed':
      return {
        label: 'Confirmed',
        statusColor: isDark ? 'rgba(252, 165, 165, 0.85)' : '#ef4444',
        badgeBg: isDark ? 'rgba(239, 68, 68, 0.12)' : '#fef2f2',
      };
    case 'resolved':
      return {
        label: 'Resolved',
        statusColor: isDark ? 'rgba(74, 222, 128, 0.85)' : '#16a34a',
        badgeBg: isDark ? 'rgba(22, 163, 74, 0.12)' : '#f0fdf4',
      };
    case 'monitor':
      return {
        label: 'Monitor',
        statusColor: isDark ? 'rgba(252, 211, 77, 0.85)' : '#f59e0b',
        badgeBg: isDark ? 'rgba(245, 158, 11, 0.12)' : '#fffbeb',
      };
    case 'not_confirmed':
      return {
        label: 'Not Confirmed',
        statusColor: isDark ? 'rgba(255, 255, 255, 0.45)' : '#6b7280',
        badgeBg: isDark ? 'rgba(255, 255, 255, 0.06)' : '#f3f4f6',
      };
  }
}

interface NotesTabProps {
  field: FieldNotesProps;
}

export function NotesTab({ field }: NotesTabProps) {
  const theme = useAppTheme();
  const isDark = theme === 'dark';
  const [selected, setSelected] = useState<ScoutNoteOutcome>('confirmed');
  const [notes, setNotes] = useState('');
  const [submittedEntries, setSubmittedEntries] = useState<readonly FieldNoteHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setSubmittedEntries([]);
    setSelected('confirmed');
    setNotes('');
    setError(null);
  }, [field.fieldId]);

  const entries = useMemo(() => {
    const merged = [...submittedEntries, ...field.entries];
    const seen = new Set<string>();

    return merged.filter((entry) => {
      if (seen.has(entry.id)) {
        return false;
      }
      seen.add(entry.id);
      return true;
    });
  }, [field.entries, submittedEntries]);

  async function submitNote() {
    const trimmed = notes.trim();

    if (!trimmed || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(field.submitUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          outcome: selected,
          noteText: trimmed,
          findingId: field.inspectionTarget?.findingId ?? null,
          zoneId: field.inspectionTarget?.zoneId ?? null,
          cellKey: field.inspectionTarget?.cellKey ?? null,
        }),
      });
      const body = (await response.json()) as
        | { note: { id: string; observedAt: string; noteText: string; outcome: ScoutNoteOutcome; findingId?: string | null; zoneId?: string | null; cellKey?: string | null } }
        | { error?: { message?: string } };
      const errorMessage =
        'error' in body ? body.error?.message : undefined;

      if (!response.ok || !('note' in body)) {
        throw new Error(errorMessage ?? 'Scout note submission failed.');
      }

      setSubmittedEntries((current) => [
        {
          id: body.note.id,
          date: body.note.observedAt,
          text: body.note.noteText,
          status: body.note.outcome,
          findingId: body.note.findingId ?? null,
          zoneId: body.note.zoneId ?? null,
          cellKey: body.note.cellKey ?? null,
        },
        ...current,
      ]);
      setNotes('');
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : 'Scout note submission failed.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="panel__body">
      {/* Title Section */}
      <div className="panel__title-section">
        <h2 className="panel__title-main">{field.name}</h2>
        <span className="panel__title-sub">{field.lld} &middot; Legal Land Description</span>
      </div>

      {/* Inspection Target */}
      {field.inspectionTarget ? (
        <div className="notes__inspection-target">
          <div className="notes__inspection-header">
            <span className="notes__inspection-label">Inspection Target</span>
            <span className="notes__inspection-date">{field.inspectionTarget.dateLabel}</span>
          </div>
          <span className="notes__inspection-name">{field.inspectionTarget.name}</span>
          <span className="notes__inspection-coord">{field.inspectionTarget.coordinateLabel}</span>
        </div>
      ) : (
        <div className="notes__inspection-target">
          <div className="notes__inspection-header">
            <span className="notes__inspection-label">Inspection Target</span>
            <span className="notes__inspection-date">Field-wide</span>
          </div>
          <span className="notes__inspection-name">No active target selected</span>
          <span className="notes__inspection-coord">Hover or select a mapped cell to scope a scout note.</span>
        </div>
      )}

      {/* What did you find? */}
      <h3 className="notes__outcome-heading">What did you find?</h3>

      {/* Outcome options */}
      <div className="notes__outcome-grid">
        {SCOUT_NOTE_OUTCOME_OPTIONS.map((option) => {
          const isSelected = selected === option.id;
          const Icon = option.icon;
          const iconColor = isDark ? option.darkColor : option.lightColor;
          const selectedBorder = isDark ? option.selectedBorderDark : option.selectedBorderLight;
          return (
            <button
              key={option.id}
              type="button"
              className={`notes__outcome-card${isSelected ? ' notes__outcome-card--selected' : ''}`}
              onClick={() => setSelected(option.id)}
              style={isSelected && selectedBorder ? { borderColor: selectedBorder } : undefined}
            >
              <Icon size={20} style={{ color: iconColor, flexShrink: 0 }} />
              <div className="notes__outcome-text">
                <span className="notes__outcome-title">{option.title}</span>
                <span className="notes__outcome-desc">{option.desc}</span>
              </div>
              {isSelected && (
                <span className="notes__outcome-check" style={{ background: selectedBorder || 'var(--primary-green)' }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Scout Notes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="notes__field-label">Scout Notes</span>
        <textarea
          className="textarea-field"
          placeholder="Describe what you observed in the field..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {/* Submit button */}
      <Button
        variant="panel-primary"
        icon={Send}
        onClick={submitNote}
        disabled={isSubmitting || notes.trim().length === 0}
      >
        {isSubmitting ? 'Submitting…' : 'Submit Scout Report'}
      </Button>
      {error ? <span className="notes__history-link" style={{ color: 'var(--status-danger)' }}>{error}</span> : null}

      {/* Previous entries section */}
      <div className="notes__history-section">
        <span className="notes__history-link">Edit previous entries</span>

        <div className="notes__history-block">
          <span className="notes__history-header">Field notes ({entries.length})</span>
          <div className="notes__history-list">
            {entries.map((entry) => {
              const meta = resolveScoutNoteOutcomeMeta(entry.status, isDark);
              return (
                <div key={entry.id} className="notes__history-card">
                  <div className="notes__history-card-top">
                    <span className="notes__history-date">{formatHistoryDate(entry.date)}</span>
                    <span
                      className="notes__history-badge"
                      style={{ color: meta.statusColor, background: meta.badgeBg }}
                    >
                      {meta.label}
                    </span>
                  </div>
                  <p className="notes__history-body">{entry.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
