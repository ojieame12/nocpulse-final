'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Search, FileSpreadsheet, Map as MapIcon, Plus, FileUp, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, Lbl, LblM, Sub, Mono } from './fieldDetailCardPrimitives';
import {
  type AddFieldRetryAction,
  describeAddFieldApiError,
  readAddFieldApiResult,
  resolveAddFieldRetryLabel,
} from './addFieldPanelErrors';
import {
  chooseFirstInsightField,
  type FirstInsightFieldEntry,
} from '../../features/fields/firstInsightChooser';

interface AddFieldPanelProps {
  onClose?: () => void;
  onFieldsChanged?: (result: {
    preferredFieldId?: string | null;
    fieldIds: string[];
    fieldEntries?: readonly FirstInsightFieldEntry[];
    fieldHydrationSummaries?: readonly CommitFieldHydrationSummary[];
  }) => void;
  onOnboardingTracked?: (result: {
    preferredFieldId?: string | null;
    fieldIds: string[];
    fieldEntries?: readonly FirstInsightFieldEntry[];
    dispatchIds: string[];
    workspaceId?: string | null;
    /** Per-dispatch mapping to field context for progress derivation */
    trackedJobs: readonly { dispatchId: string; fieldId: string; fieldLabel: string }[];
    /** Pre-built hydration summaries from the commit response (if available). */
    fieldHydrationSummaries?: readonly CommitFieldHydrationSummary[];
  }) => void;
  /** Dispatch statuses owned by the parent — AddFieldPanel reads these instead of polling. */
  jobStatuses?: ReadonlyMap<string, JobDispatchSnapshot>;
  workspaceId?: string | null;
}

const METHODS = [
  { key: 'lld', label: 'LLD Lookup', icon: Search, desc: 'Search by legal land description' },
  { key: 'csv', label: 'Upload CSV', icon: FileSpreadsheet, desc: 'Bulk import from spreadsheet' },
  { key: 'kml', label: 'Upload KML', icon: MapIcon, desc: 'Import boundary from geo file' },
] as const;

type MethodKey = typeof METHODS[number]['key'];
type NoticeTone = 'neutral' | 'positive' | 'danger';

type LldLookupPayload = {
  parsed?: { normalized?: string };
  draft: { name: string; areaHa: number };
  resolution: string;
};

type BoundaryPreviewPayload = {
  format: string;
  draft: { name: string; areaHa: number };
};

type SpreadsheetPreviewPayload = {
  fileName: string;
  sheetName: string;
  rowCount: number;
  validRowCount: number;
  fieldCount: number;
  issueCount: number;
  issues: Array<{ rowNumber: number; message: string }>;
  fields: Array<{ draft: { name: string; areaHa: number } }>;
};

/** Mirrors FieldHydrationStageSummary from ServerServices. */
export type CommitHydrationStageSummary = {
  key: 'soil' | 'weather' | 'imagery' | 'moisture';
  label: string;
  state: 'pending' | 'completed';
  statusText: string;
};

/** Mirrors FieldMoistureConfidenceSummary from ServerServices (subset for UI). */
export type CommitMoistureConfidence = {
  level: 'low' | 'medium' | 'high' | 'unknown';
  score: number | null;
  reason: string | null;
  derivationMode: 'source-backed' | 'seeded-range' | null;
  rasterMode: 'provider' | 'synthetic' | 'none' | null;
  signalBlend: 'raster+weather' | 'raster-only' | 'weather-only' | 'seeded' | null;
  usedOptical: boolean;
  usedSar: boolean;
  usedWeather: boolean;
  usedWeatherSoilMoisture: boolean;
};

/** Mirrors FieldHydrationSummary.coverage from ServerServices (subset for UI). */
export type CommitHydrationCoverage = {
  hasSoilContext: boolean;
  hasWeatherObservation: boolean;
  hasWeatherForecast: boolean;
  hasRasterObservation: boolean;
  hasMoistureSnapshot: boolean;
};
/** Mirrors FieldHydrationSummary from ServerServices (subset used by frontend). */
export type CommitFieldHydrationSummary = {
  fieldId: string;
  fieldName: string;
  status: 'queued' | 'completed';
  progressPct: number;
  phaseLabel: string;
  stages: readonly CommitHydrationStageSummary[];
  coverage?: CommitHydrationCoverage;
  moistureConfidence?: CommitMoistureConfidence | null;
};

/** Mirrors BatchHydrationSummary from ServerServices (subset). */
export type CommitBatchHydrationSummary = {
  totalFields: number;
  completedFields: number;
  queuedFields: number;
  highConfidenceFields: number;
};

type SpreadsheetCommitPayload = {
  batch: { status: string };
  candidates: Array<{
    field: { id: string; name: string };
    action: string;
    candidate: {
      cropType?: string;
      legalLandDescriptions: readonly string[];
    };
  }>;
  onboardingDispatches: Array<{ fieldId: string; action: string; receipts: Array<{ result: { id: string; key?: string; status?: string } }> }>;
  fieldHydrationSummaries?: readonly CommitFieldHydrationSummary[];
  batchHydrationSummary?: CommitBatchHydrationSummary;
};

type ManualFieldCreatePayload = {
  action: 'created' | 'reused';
  field: {
    id: string;
    name: string;
    areaHa: number;
    legalLandDescription: string | null;
  };
  cropContext: {
    seasonYear: number;
    cropType: string;
  } | null;
  onboardingDispatches?: Array<{
    fieldId: string;
    action: 'created' | 'reused';
    receipts: Array<{ result: { id: string; key?: string; status?: string } }>;
  }>;
  intakeMetadata?: {
    method?: 'lld';
    lldResolution?: 'cached' | 'synthetic';
    boundaryConfidenceLabel?: string;
  };
};

type PreviewCard = {
  title: string;
  description?: string;
  rows: Array<{ label: string; value: string }>;
};

type SpreadsheetIssue = SpreadsheetPreviewPayload['issues'][number];
type JobDispatchSnapshot = {
  id: string;
  key: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  activePhaseLabel: string | null;
  progressPct: number | null;
  progressMessage: string | null;
  updatedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  cancelledAt: string | null;
  lastError: string | null;
  fieldId: string | null;
};

type TrackedJob = {
  dispatchId: string;
  fieldId: string;
  fieldLabel: string;
  action: string;
  fieldAction?: 'created' | 'reused';
  cropType?: string | null;
  legalLandDescriptions?: readonly string[];
};

type TrackedJobMetadata = {
  fieldAction?: 'created' | 'reused';
  cropType?: string | null;
  legalLandDescriptions?: readonly string[];
};

type HydrationRetryPayload = {
  replayResult: {
    action: 'replayed' | 'skipped';
    reason?: string;
  } | null;
  onboardingDispatches: Array<{
    fieldId: string;
    action: 'created' | 'reused';
    receipts: Array<{ result: { id: string; key?: string; status?: string } }>;
  }>;
};

const JOB_STATUS_POLL_MS = 3_000;
const EMPTY_PREVIEW_ID = "__empty__";

function normalizeWorkspaceId(workspaceId?: string | null) {
  return workspaceId && workspaceId !== EMPTY_PREVIEW_ID ? workspaceId : null;
}

function formatArea(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${value.toFixed(1)} ha`
    : 'N/A';
}

function countQueuedJobs(
  entries: readonly { receipts: readonly { result: { id: string } }[] }[] | null | undefined,
) {
  return (entries ?? []).reduce(
    (count, entry) => count + (Array.isArray(entry.receipts) ? entry.receipts.length : 0),
    0,
  );
}

function countQueuedFields(
  entries: readonly { receipts: readonly { result: { id: string } }[] }[] | null | undefined,
) {
  return (entries ?? []).filter(
    (entry) => Array.isArray(entry.receipts) && entry.receipts.length > 0,
  ).length;
}

function resolveLldBoundarySourceLabel(resolution: string | null | undefined) {
  return resolution === 'cached' ? 'Cached parcel' : 'Synthetic DLS';
}

function formatJobStatusLabel(status: JobDispatchSnapshot['status']) {
  switch (status) {
    case 'queued':
      return 'Queued';
    case 'running':
      return 'Running';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    case 'cancelled':
      return 'Cancelled';
  }
}

function buildTrackedJobs(
  entries:
    | readonly {
        fieldId: string;
        action: string;
        receipts: readonly { result: { id: string } }[];
      }[]
    | null
    | undefined,
  fieldLabelById?: Map<string, string>,
  metadataByFieldId?: Map<string, TrackedJobMetadata>,
) {
  return (entries ?? []).flatMap((entry) =>
    (Array.isArray(entry.receipts) ? entry.receipts : []).map((receipt) => {
      const metadata = metadataByFieldId?.get(entry.fieldId);

      return {
        dispatchId: receipt.result.id,
        fieldId: entry.fieldId,
        fieldLabel: fieldLabelById?.get(entry.fieldId) ?? entry.fieldId,
        action: entry.action,
        fieldAction:
          metadata?.fieldAction
          ?? (entry.action === 'created' || entry.action === 'reused'
            ? entry.action
            : undefined),
        cropType: metadata?.cropType ?? null,
        legalLandDescriptions: metadata?.legalLandDescriptions,
      };
    }),
  );
}

function describeHydrationReplayResult(
  replayResult: HydrationRetryPayload['replayResult'],
) {
  if (!replayResult) {
    return 'Queued a fresh onboarding run for that field.';
  }

  if (replayResult.action === 'replayed') {
    return 'Copied hydrated parcel context, then queued a fresh onboarding run.';
  }

  if (replayResult.reason === 'no-source-field') {
    return 'Could not find a matching hydrated source parcel, but queued a fresh onboarding run.';
  }

  if (replayResult.reason === 'no-hydrated-source') {
    return 'Found a matching parcel, but no hydrated source was available yet. A fresh onboarding run is queued.';
  }

  if (replayResult.reason === 'missing-stable-key') {
    return 'That field does not have a stable lookup key yet. A fresh onboarding run is queued.';
  }

  return 'Queued a fresh onboarding run for that field.';
}

function FieldInput({
  label,
  placeholder,
  type = 'text',
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span className="fdp-lbl fdp-lbl--muted">
        {label}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.currentTarget.value)}
        style={{
          padding: '10px 14px', borderRadius: 10,
          border: '1px solid var(--border-medium)', background: 'rgba(255,255,255,0.06)',
          fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-primary)',
          outline: 'none', transition: 'border-color 200ms ease',
        }}
        onFocus={(event) => { event.currentTarget.style.borderColor = 'var(--primary-green)'; }}
        onBlur={(event) => { event.currentTarget.style.borderColor = 'var(--border-medium)'; }}
      />
    </div>
  );
}

/* ── Custom date picker matching NocPulse glass theme ── */

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_HEADERS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function FieldDateInput({
  label,
  placeholder = 'Select date…',
  value,
  onChange,
}: {
  label: string;
  placeholder?: string;
  value: string; // yyyy-mm-dd or ''
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse current value or default to today's month
  const today = useMemo(() => new Date(), []);
  const selectedDate = useMemo(() => (value ? new Date(value + 'T00:00:00') : null), [value]);
  const [viewYear, setViewYear] = useState(selectedDate?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate?.getMonth() ?? today.getMonth());

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  // Build calendar grid (6 weeks max)
  const calendarDays = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    // Monday = 0 based start
    let startDow = first.getDay() - 1;
    if (startDow < 0) startDow = 6;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const days: Array<{ day: number; inMonth: boolean; date: Date }> = [];

    // Previous month fill
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();
    for (let i = startDow - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      days.push({ day: d, inMonth: false, date: new Date(viewYear, viewMonth - 1, d) });
    }
    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ day: d, inMonth: true, date: new Date(viewYear, viewMonth, d) });
    }
    // Next month fill to 42 cells
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      days.push({ day: d, inMonth: false, date: new Date(viewYear, viewMonth + 1, d) });
    }
    return days;
  }, [viewYear, viewMonth]);

  const prevMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 0) { setViewYear((y) => y - 1); return 11; }
      return m - 1;
    });
  }, []);

  const nextMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 11) { setViewYear((y) => y + 1); return 0; }
      return m + 1;
    });
  }, []);

  const selectDay = useCallback((date: Date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    onChange(`${yyyy}-${mm}-${dd}`);
    setOpen(false);
  }, [onChange]);

  const isSameDay = (a: Date, b: Date | null) =>
    b != null && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const displayValue = selectedDate
    ? selectedDate.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })
    : '';

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: 4, position: 'relative' }}>
      <span className="fdp-lbl fdp-lbl--muted">{label}</span>
      <button
        type="button"
        className="noc-date-trigger"
        onClick={() => {
          if (!open && selectedDate) {
            setViewYear(selectedDate.getFullYear());
            setViewMonth(selectedDate.getMonth());
          }
          setOpen((o) => !o);
        }}
      >
        <span className={displayValue ? 'noc-date-trigger__value' : 'noc-date-trigger__placeholder'}>
          {displayValue || placeholder}
        </span>
        <Calendar size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
      </button>

      {open && (
        <div className="noc-calendar">
          {/* Header */}
          <div className="noc-calendar__header">
            <button type="button" className="noc-calendar__nav" onClick={prevMonth}>
              <ChevronLeft size={14} />
            </button>
            <span className="noc-calendar__title">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button type="button" className="noc-calendar__nav" onClick={nextMonth}>
              <ChevronRight size={14} />
            </button>
          </div>
          {/* Day-of-week headers */}
          <div className="noc-calendar__grid">
            {DAY_HEADERS.map((d) => (
              <span key={d} className="noc-calendar__dow">{d}</span>
            ))}
            {calendarDays.map((cell, i) => {
              const isToday = isSameDay(cell.date, today);
              const isSelected = isSameDay(cell.date, selectedDate);
              return (
                <button
                  key={i}
                  type="button"
                  className={[
                    'noc-calendar__day',
                    !cell.inMonth && 'noc-calendar__day--outside',
                    isToday && 'noc-calendar__day--today',
                    isSelected && 'noc-calendar__day--selected',
                  ].filter(Boolean).join(' ')}
                  onClick={() => selectDay(cell.date)}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
          {/* Footer */}
          <div className="noc-calendar__footer">
            <button
              type="button"
              className="noc-calendar__footer-btn"
              onClick={() => { onChange(''); setOpen(false); }}
            >
              Clear
            </button>
            <button
              type="button"
              className="noc-calendar__footer-btn noc-calendar__footer-btn--primary"
              onClick={() => { selectDay(today); }}
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DropZone({
  label,
  accept,
  selectedFile,
  onFileSelect,
}: {
  label: string;
  accept: string;
  selectedFile: File | null;
  onFileSelect: (file: File | null) => void;
}) {
  const [dragging, setDragging] = useState(false);

  const openFilePicker = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => {
      const nextFile = input.files?.[0] ?? null;
      onFileSelect(nextFile);
    };
    input.click();
  };

  return (
    <div
      onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        onFileSelect(event.dataTransfer.files?.[0] ?? null);
      }}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 8, padding: '32px 16px', borderRadius: 12,
        border: `2px dashed ${dragging ? 'var(--primary-green)' : 'var(--border-light)'}`,
        background: dragging ? 'rgba(22,163,74,0.04)' : 'transparent',
        cursor: 'pointer', transition: 'all 200ms ease',
      }}
      onClick={openFilePicker}
    >
      <FileUp size={24} style={{ color: dragging ? 'var(--primary-green)' : 'var(--text-muted)' }} />
      <Sub>{selectedFile ? selectedFile.name : label}</Sub>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: 'var(--text-tertiary)' }}>
        {selectedFile ? 'click or drop to replace' : 'or click to browse'}
      </span>
    </div>
  );
}

function PreviewSummaryCard({ preview, tone }: { preview: PreviewCard; tone: NoticeTone }) {
  const accent =
    tone === 'danger'
      ? '#ef4444'
      : tone === 'positive'
        ? 'var(--primary-green)'
        : undefined;

  return (
    <Card span={-1} accent={accent}>
      <Lbl>{preview.title}</Lbl>
      {preview.description ? <Sub>{preview.description}</Sub> : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {preview.rows.map((row) => (
          <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <Sub>{row.label}</Sub>
            <Mono>{row.value}</Mono>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function SpreadsheetIssuesCard({
  issues,
}: {
  issues: readonly SpreadsheetIssue[];
}) {
  const visibleIssues = issues.slice(0, 6);
  const hiddenCount = Math.max(0, issues.length - visibleIssues.length);

  return (
    <Card span={-1} accent="#ef4444">
      <Lbl>IMPORT ISSUES</Lbl>
      <Sub>Review the flagged rows before committing the spreadsheet import.</Sub>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {visibleIssues.map((issue) => (
          <div
            key={`${issue.rowNumber}-${issue.message}`}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              alignItems: 'flex-start',
            }}
          >
            <LblM>Row {issue.rowNumber}</LblM>
            <div style={{ textAlign: 'right', whiteSpace: 'normal', maxWidth: '70%' }}>
              <Mono>{issue.message}</Mono>
            </div>
          </div>
        ))}
        {hiddenCount > 0 ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <Sub>Additional issues</Sub>
            <Mono>{hiddenCount} more</Mono>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export function JobStatusCard({
  trackedJobs,
  jobStatuses,
  onRetryHydration,
  retryingFieldId = null,
}: {
  trackedJobs: readonly TrackedJob[];
  jobStatuses: ReadonlyMap<string, JobDispatchSnapshot>;
  onRetryHydration?: (job: TrackedJob) => void;
  retryingFieldId?: string | null;
}) {
  if (trackedJobs.length === 0) {
    return null;
  }

  const summary = trackedJobs.reduce(
    (counts, job) => {
      const status = jobStatuses.get(job.dispatchId)?.status ?? 'queued';
      counts[status] += 1;
      return counts;
    },
    { queued: 0, running: 0, completed: 0, failed: 0, cancelled: 0 },
  );
  const failedJobCount = summary.failed + summary.cancelled;
  const hasFailures = failedJobCount > 0;

  return (
    <Card span={-1}>
      <Lbl>ONBOARDING STATUS</Lbl>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <span className="fdp__chip" style={{ fontSize: 9 }}>Queued {summary.queued}</span>
        <span className="fdp__chip" style={{ fontSize: 9 }}>Running {summary.running}</span>
        <span className="fdp__chip" style={{ fontSize: 9 }}>Completed {summary.completed}</span>
        {summary.failed > 0 ? (
          <span className="fdp__chip" style={{ fontSize: 9 }}>Failed {summary.failed}</span>
        ) : null}
        {summary.cancelled > 0 ? (
          <span className="fdp__chip" style={{ fontSize: 9 }}>Cancelled {summary.cancelled}</span>
        ) : null}
      </div>
      {hasFailures ? (
        <Sub>
          {summary.completed} completed, {summary.failed} failed, {summary.cancelled} cancelled.
          Retry the affected field without starting over.
        </Sub>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {trackedJobs.slice(0, 6).map((job) => {
          const snapshot = jobStatuses.get(job.dispatchId);
          const statusLabel = formatJobStatusLabel(snapshot?.status ?? 'queued');
          const progressLabel =
            snapshot?.progressPct != null && Number.isFinite(snapshot.progressPct)
              ? `${Math.round(snapshot.progressPct)}%`
              : null;
          const phaseLabel = snapshot?.activePhaseLabel || snapshot?.progressMessage || 'Awaiting worker';
          const canRetry =
            onRetryHydration
            && (snapshot?.status === 'failed' || snapshot?.status === 'cancelled');
          const retryBusy = retryingFieldId === job.fieldId;

          return (
            <div
              key={job.dispatchId}
              style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <LblM>{job.fieldLabel}</LblM>
                <Sub>{phaseLabel}</Sub>
                {snapshot?.lastError ? <Sub>{snapshot.lastError}</Sub> : null}
                {canRetry ? (
                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <button
                      type="button"
                      onClick={() => onRetryHydration(job)}
                      disabled={retryBusy}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 10,
                        border: '1px solid rgba(239,68,68,0.25)',
                        background: 'rgba(239,68,68,0.08)',
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-body)',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: retryBusy ? 'not-allowed' : 'pointer',
                        opacity: retryBusy ? 0.6 : 1,
                      }}
                    >
                      {retryBusy ? 'Retrying…' : 'Retry hydration'}
                    </button>
                  </div>
                ) : null}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'right', flexShrink: 0 }}>
                <Mono>{statusLabel}</Mono>
                {progressLabel ? <Mono>{progressLabel}</Mono> : null}
              </div>
            </div>
          );
        })}
        {trackedJobs.length > 6 ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <Sub>Additional jobs</Sub>
            <Mono>{trackedJobs.length - 6} more</Mono>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export function AddFieldPanel({
  onClose,
  onFieldsChanged,
  onOnboardingTracked,
  jobStatuses: parentJobStatuses,
  workspaceId = null,
}: AddFieldPanelProps) {
  const effectiveWorkspaceId = normalizeWorkspaceId(workspaceId);
  const [method, setMethod] = useState<MethodKey>('lld');
  const [fieldName, setFieldName] = useState('');
  const [lldCode, setLldCode] = useState('');
  const [cropType, setCropType] = useState('');
  const [variety, setVariety] = useState('');
  const [seedingDate, setSeedingDate] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusTone, setStatusTone] = useState<NoticeTone>('neutral');
  const [statusText, setStatusText] = useState<string | null>(null);
  const [retryAction, setRetryAction] = useState<AddFieldRetryAction | null>(null);
  const [previewCard, setPreviewCard] = useState<PreviewCard | null>(null);
  const [spreadsheetPreview, setSpreadsheetPreview] = useState<SpreadsheetPreviewPayload | null>(null);
  const [trackedJobs, setTrackedJobs] = useState<TrackedJob[]>([]);
  const [retryingHydrationFieldId, setRetryingHydrationFieldId] = useState<string | null>(null);
  const [retryingHydrationFieldLabel, setRetryingHydrationFieldLabel] = useState<string | null>(null);
  const [lldDraftReady, setLldDraftReady] = useState(false);
  const [boundaryDraftReady, setBoundaryDraftReady] = useState(false);

  /* Job statuses come from the parent shell (which owns the single polling
     loop). Fall back to an empty map if no parent supplies them. */
  const jobStatuses: ReadonlyMap<string, JobDispatchSnapshot> = parentJobStatuses ?? new Map();
  const isRetryingHydration = retryingHydrationFieldId != null;

  const clearFeedback = () => {
    setStatusTone('neutral');
    setStatusText(null);
    setRetryAction(null);
    setPreviewCard(null);
    setSpreadsheetPreview(null);
    setTrackedJobs([]);
    setRetryingHydrationFieldId(null);
    setRetryingHydrationFieldLabel(null);
    setLldDraftReady(false);
    setBoundaryDraftReady(false);
  };

  const primaryLabel = useMemo(() => {
    if (isRetryingHydration) {
      return 'Retrying Hydration';
    }

    if (isSubmitting) {
      switch (method) {
        case 'lld':
          return lldDraftReady ? 'Creating' : 'Looking Up';
        case 'csv':
          return spreadsheetPreview ? 'Importing' : 'Uploading';
        case 'kml':
          return boundaryDraftReady ? 'Creating' : 'Parsing';
      }
    }

    switch (method) {
      case 'lld':
        return lldDraftReady ? 'Create Field' : 'Lookup LLD';
      case 'csv':
        return spreadsheetPreview ? `Import ${spreadsheetPreview.fieldCount} Fields` : 'Upload & Preview';
      case 'kml':
        return boundaryDraftReady ? 'Create Field' : 'Parse Boundary';
    }
  }, [boundaryDraftReady, isRetryingHydration, isSubmitting, lldDraftReady, method, spreadsheetPreview]);

  const primaryDisabled = useMemo(() => {
    if (isSubmitting) return true;

    switch (method) {
      case 'lld':
        return !lldCode.trim();
      case 'csv':
      case 'kml':
        return !selectedFile;
    }
  }, [isSubmitting, lldCode, method, selectedFile]);

  const handleMethodSelect = (nextMethod: MethodKey) => {
    setMethod(nextMethod);
    setSelectedFile(null);
    clearFeedback();
  };

  const handleLookupLld = async () => {
    const response = await fetch('/api/field-intake/lld/lookup', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        code: lldCode.trim(),
        suggestedFieldName: fieldName.trim() || undefined,
      }),
    });

    const result = await readAddFieldApiResult<LldLookupPayload>(response);

    setPreviewCard({
      title: 'LLD Draft Ready',
      description: cropType.trim()
        ? `${result.draft.name} · ${cropType.trim()}`
        : result.draft.name,
      rows: [
        { label: 'LLD', value: result.parsed?.normalized ?? lldCode.trim().toUpperCase() },
        { label: 'Area', value: formatArea(result.draft.areaHa) },
        { label: 'Boundary Source', value: resolveLldBoundarySourceLabel(result.resolution) },
        { label: 'Seeding', value: seedingDate || 'N/A' },
      ],
    });
    setStatusTone(result.resolution === 'cached' ? 'positive' : 'neutral');
    setStatusText(
      result.resolution === 'cached'
        ? 'Legal land lookup completed from cached parcel geometry.'
        : 'Legal land lookup completed from synthetic DLS geometry. Review boundary accuracy before creating the field.',
    );
    setLldDraftReady(true);
    setBoundaryDraftReady(false);
    setRetryAction(null);
  };

  const handleCreateLldField = async () => {
    const response = await fetch('/api/field-intake/lld/create', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        workspaceId: effectiveWorkspaceId ?? undefined,
        code: lldCode.trim(),
        suggestedFieldName: fieldName.trim() || undefined,
        cropType: cropType.trim() || undefined,
        variety: variety.trim() || undefined,
        seedingDate: seedingDate || undefined,
      }),
    });

    const result = await readAddFieldApiResult<ManualFieldCreatePayload>(response);
    const queuedJobCount = countQueuedJobs(result.onboardingDispatches);
    const lldResolution = result.intakeMetadata?.lldResolution;
    const boundaryConfidenceLabel =
      result.intakeMetadata?.boundaryConfidenceLabel
      ?? resolveLldBoundarySourceLabel(lldResolution);

    setPreviewCard({
      title: result.action === 'created' ? 'Field Created' : 'Field Reused',
      description: result.cropContext?.cropType
        ? `${result.field.name} · ${result.cropContext.cropType}`
        : result.field.name,
      rows: [
        { label: 'Field ID', value: result.field.id },
        { label: 'LLD', value: result.field.legalLandDescription ?? lldCode.trim().toUpperCase() },
        { label: 'Area', value: formatArea(result.field.areaHa) },
        { label: 'Boundary Source', value: boundaryConfidenceLabel },
        { label: 'Crop', value: result.cropContext?.cropType ?? (cropType.trim() || 'N/A') },
        { label: 'Season', value: result.cropContext ? String(result.cropContext.seasonYear) : 'N/A' },
        { label: 'Queued Jobs', value: String(queuedJobCount) },
      ],
    });
    setStatusTone(lldResolution === 'synthetic' ? 'neutral' : 'positive');
    setStatusText(
      lldResolution === 'synthetic'
        ? result.action === 'created'
          ? `LLD field created from synthetic DLS geometry and queued ${queuedJobCount} follow-up job${queuedJobCount === 1 ? '' : 's'}. Review boundary accuracy.`
          : `Existing LLD field reused with synthetic DLS geometry and queued ${queuedJobCount} refresh job${queuedJobCount === 1 ? '' : 's'}. Review boundary accuracy.`
        : result.action === 'created'
          ? `LLD field created from cached parcel geometry and queued ${queuedJobCount} follow-up job${queuedJobCount === 1 ? '' : 's'}.`
          : `Existing LLD field reused from cached parcel geometry and queued ${queuedJobCount} refresh job${queuedJobCount === 1 ? '' : 's'}.`,
    );
    const nextTrackedJobs = buildTrackedJobs(
      result.onboardingDispatches,
      new Map([[result.field.id, result.field.name]]),
      new Map([
        [
          result.field.id,
          {
            fieldAction:
              result.action === 'created' || result.action === 'reused'
                ? result.action
                : undefined,
            cropType: result.cropContext?.cropType ?? (cropType.trim() || null),
            legalLandDescriptions: result.field.legalLandDescription
              ? [result.field.legalLandDescription]
              : undefined,
          },
        ],
      ]),
    );
    const fieldEntries = [{ fieldId: result.field.id, fieldName: result.field.name }] as const;
    const preferredFieldId = chooseFirstInsightField({
      workspaceId: effectiveWorkspaceId,
      preferredFieldId: result.field.id,
      fieldEntries,
    });
    setTrackedJobs(nextTrackedJobs);
    setLldDraftReady(false);
    setRetryAction(null);
    onOnboardingTracked?.({
      preferredFieldId,
      fieldIds: [result.field.id],
      fieldEntries,
      dispatchIds: Array.from(new Set(nextTrackedJobs.map((job) => job.dispatchId))),
      workspaceId: effectiveWorkspaceId,
      trackedJobs: nextTrackedJobs,
    });
    onFieldsChanged?.({
      preferredFieldId,
      fieldIds: [result.field.id],
      fieldEntries,
    });
  };

  const handlePreviewBoundaryFile = async () => {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.set('file', selectedFile);
    if (fieldName.trim()) {
      formData.set('suggestedFieldName', fieldName.trim());
    }

    const response = await fetch('/api/field-intake/geofile/parse', {
      method: 'POST',
      body: formData,
    });

    const result = await readAddFieldApiResult<BoundaryPreviewPayload>(response);

    setPreviewCard({
      title: 'Boundary Preview Ready',
      description: result.draft.name,
      rows: [
        { label: 'Format', value: result.format.toUpperCase() },
        { label: 'Area', value: formatArea(result.draft.areaHa) },
        { label: 'File', value: selectedFile.name },
        { label: 'Crop', value: cropType.trim() || 'N/A' },
      ],
    });
    setStatusTone('positive');
    setStatusText('Boundary file parsed successfully.');
    setBoundaryDraftReady(true);
    setLldDraftReady(false);
    setRetryAction(null);
  };

  const handleCreateBoundaryField = async () => {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.set('file', selectedFile);
    if (effectiveWorkspaceId) {
      formData.set('workspaceId', effectiveWorkspaceId);
    }
    if (fieldName.trim()) {
      formData.set('suggestedFieldName', fieldName.trim());
    }
    if (cropType.trim()) {
      formData.set('cropType', cropType.trim());
    }
    if (variety.trim()) {
      formData.set('variety', variety.trim());
    }
    if (seedingDate) {
      formData.set('seedingDate', seedingDate);
    }

    const response = await fetch('/api/field-intake/geofile/create', {
      method: 'POST',
      body: formData,
    });

    const result = await readAddFieldApiResult<ManualFieldCreatePayload>(response);
    const queuedJobCount = countQueuedJobs(result.onboardingDispatches);

    setPreviewCard({
      title: result.action === 'created' ? 'Field Created' : 'Field Reused',
      description: result.cropContext?.cropType
        ? `${result.field.name} · ${result.cropContext.cropType}`
        : result.field.name,
      rows: [
        { label: 'Field ID', value: result.field.id },
        { label: 'Area', value: formatArea(result.field.areaHa) },
        { label: 'File', value: selectedFile.name },
        { label: 'Crop', value: result.cropContext?.cropType ?? (cropType.trim() || 'N/A') },
        { label: 'Season', value: result.cropContext ? String(result.cropContext.seasonYear) : 'N/A' },
        { label: 'Queued Jobs', value: String(queuedJobCount) },
      ],
    });
    setStatusTone('positive');
    setStatusText(
      result.action === 'created'
        ? `Boundary field created successfully and queued ${queuedJobCount} follow-up job${queuedJobCount === 1 ? '' : 's'}.`
        : `Existing boundary field reused and queued ${queuedJobCount} refresh job${queuedJobCount === 1 ? '' : 's'}.`,
    );
    const nextTrackedJobs = buildTrackedJobs(
      result.onboardingDispatches,
      new Map([[result.field.id, result.field.name]]),
      new Map([
        [
          result.field.id,
          {
            fieldAction:
              result.action === 'created' || result.action === 'reused'
                ? result.action
                : undefined,
            cropType: result.cropContext?.cropType ?? (cropType.trim() || null),
          },
        ],
      ]),
    );
    const fieldEntries = [{ fieldId: result.field.id, fieldName: result.field.name }] as const;
    const preferredFieldId = chooseFirstInsightField({
      workspaceId: effectiveWorkspaceId,
      preferredFieldId: result.field.id,
      fieldEntries,
    });
    setTrackedJobs(nextTrackedJobs);
    setBoundaryDraftReady(false);
    setRetryAction(null);
    onOnboardingTracked?.({
      preferredFieldId,
      fieldIds: [result.field.id],
      fieldEntries,
      dispatchIds: Array.from(new Set(nextTrackedJobs.map((job) => job.dispatchId))),
      workspaceId: effectiveWorkspaceId,
      trackedJobs: nextTrackedJobs,
    });
    onFieldsChanged?.({
      preferredFieldId,
      fieldIds: [result.field.id],
      fieldEntries,
    });
  };

  const handlePreviewSpreadsheet = async () => {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.set('file', selectedFile);

    const response = await fetch('/api/field-intake/spreadsheet/preview', {
      method: 'POST',
      body: formData,
    });

    const result = await readAddFieldApiResult<SpreadsheetPreviewPayload>(response);
    setSpreadsheetPreview(result);
    setLldDraftReady(false);
    setBoundaryDraftReady(false);
    setPreviewCard({
      title: 'Import Preview Ready',
      description:
        result.fields[0]?.draft.name ??
        `${result.fieldCount} field${result.fieldCount === 1 ? '' : 's'} ready`,
      rows: [
        { label: 'File', value: result.fileName },
        { label: 'Sheet', value: result.sheetName },
        { label: 'Rows', value: String(result.rowCount) },
        { label: 'Fields', value: String(result.fieldCount) },
        { label: 'Issues', value: String(result.issueCount) },
      ],
    });
    setStatusTone(result.fieldCount === 0 ? 'danger' : result.issueCount > 0 ? 'neutral' : 'positive');
    setStatusText(
      result.fieldCount === 0
        ? 'We could not find any importable field rows in that spreadsheet. Review the columns and upload a corrected file.'
        : result.issueCount > 0
          ? `Preview found ${result.issueCount} issue${result.issueCount === 1 ? '' : 's'}.`
          : 'Spreadsheet preview completed successfully.',
    );
    setRetryAction(null);
  };

  const handleCommitSpreadsheet = async () => {
    if (!spreadsheetPreview) return;

    const saveResponse = await fetch('/api/field-intake/spreadsheet/batches', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        workspaceId: effectiveWorkspaceId ?? undefined,
        preview: spreadsheetPreview,
      }),
    });
    const saved = await readAddFieldApiResult<{ batch: { id: string } }>(saveResponse);

    const commitResponse = await fetch(
      `/api/field-intake/spreadsheet/batches/${saved.batch.id}/commit`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          workspaceId: effectiveWorkspaceId ?? undefined,
          onboardingDryRun: false,
        }),
      },
    );
    const committed = await readAddFieldApiResult<SpreadsheetCommitPayload>(commitResponse);
    const createdCount = committed.candidates.filter((entry) => entry.action === 'created').length;
    const reusedCount = committed.candidates.length - createdCount;
    const queuedFieldCount = countQueuedFields(committed.onboardingDispatches);
    const queuedJobCount = countQueuedJobs(committed.onboardingDispatches);

    setPreviewCard({
      title: 'Fields Imported',
      description:
        committed.candidates[0]?.field.name ??
        `${committed.candidates.length} field${committed.candidates.length === 1 ? '' : 's'} committed`,
      rows: [
        { label: 'Batch', value: committed.batch.status },
        { label: 'Created', value: String(createdCount) },
        { label: 'Reused', value: String(reusedCount) },
        { label: 'Queued Fields', value: String(queuedFieldCount) },
        { label: 'Queued Jobs', value: String(queuedJobCount) },
        { label: 'Workspace', value: effectiveWorkspaceId ?? 'Active actor workspace' },
      ],
    });
    setSpreadsheetPreview(null);
    setStatusTone('positive');
    setStatusText(
      `Imported ${committed.candidates.length} field${committed.candidates.length === 1 ? '' : 's'} and queued ${queuedJobCount} follow-up job${queuedJobCount === 1 ? '' : 's'}. Fields will appear in the strip as each one finishes onboarding.`,
    );
    const nextTrackedJobs = buildTrackedJobs(
      committed.onboardingDispatches,
      new Map(committed.candidates.map((entry) => [entry.field.id, entry.field.name])),
      new Map(
        committed.candidates.map((entry) => [
          entry.field.id,
          {
            fieldAction:
              entry.action === 'created' || entry.action === 'reused'
                ? entry.action
                : undefined,
            cropType: entry.candidate.cropType ?? null,
            legalLandDescriptions: entry.candidate.legalLandDescriptions,
          },
        ]),
      ),
    );
    const fieldEntries = committed.candidates.map((entry) => ({
      fieldId: entry.field.id,
      fieldName: entry.field.name,
    }));
    const preferredFieldId = chooseFirstInsightField({
      workspaceId: effectiveWorkspaceId,
      preferredFieldId:
        committed.candidates.length === 1
          ? (committed.candidates[0]?.field.id ?? null)
          : null,
      fieldEntries,
      hydrationSummaries: committed.fieldHydrationSummaries,
    });
    setTrackedJobs(nextTrackedJobs);
    setRetryAction(null);
    onOnboardingTracked?.({
      preferredFieldId,
      fieldIds: committed.candidates.map((entry) => entry.field.id),
      fieldEntries,
      dispatchIds: Array.from(new Set(nextTrackedJobs.map((job) => job.dispatchId))),
      workspaceId: effectiveWorkspaceId,
      trackedJobs: nextTrackedJobs,
      fieldHydrationSummaries: committed.fieldHydrationSummaries,
    });
    onFieldsChanged?.({
      preferredFieldId,
      fieldIds: committed.candidates.map((entry) => entry.field.id),
      fieldEntries,
      fieldHydrationSummaries: committed.fieldHydrationSummaries,
    });
  };

  const handlePrimaryAction = async () => {
    let attemptedAction: AddFieldRetryAction;

    switch (method) {
      case 'lld':
        attemptedAction = lldDraftReady ? 'lld-create' : 'lld-lookup';
        break;
      case 'csv':
        attemptedAction = spreadsheetPreview ? 'spreadsheet-commit' : 'spreadsheet-preview';
        break;
      case 'kml':
        attemptedAction = boundaryDraftReady ? 'boundary-create' : 'boundary-parse';
        break;
    }

    setIsSubmitting(true);

    try {
      switch (method) {
        case 'lld':
          if (lldDraftReady) {
            await handleCreateLldField();
          } else {
            await handleLookupLld();
          }
          break;
        case 'csv':
          if (spreadsheetPreview) {
            await handleCommitSpreadsheet();
          } else {
            await handlePreviewSpreadsheet();
          }
          break;
        case 'kml':
          if (boundaryDraftReady) {
            await handleCreateBoundaryField();
          } else {
            await handlePreviewBoundaryFile();
          }
          break;
      }
    } catch (error) {
      setStatusTone('danger');
      setStatusText(describeAddFieldApiError(error));
      setRetryAction(attemptedAction);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetryAction = async () => {
    if (!retryAction || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      switch (retryAction) {
        case 'lld-lookup':
          await handleLookupLld();
          break;
        case 'lld-create':
          await handleCreateLldField();
          break;
        case 'boundary-parse':
          await handlePreviewBoundaryFile();
          break;
        case 'boundary-create':
          await handleCreateBoundaryField();
          break;
        case 'spreadsheet-preview':
          await handlePreviewSpreadsheet();
          break;
        case 'spreadsheet-commit':
          await handleCommitSpreadsheet();
          break;
      }
    } catch (error) {
      setStatusTone('danger');
      setStatusText(describeAddFieldApiError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetryHydration = async (job: TrackedJob) => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setRetryingHydrationFieldId(job.fieldId);
    setRetryingHydrationFieldLabel(job.fieldLabel);

    try {
      const response = await fetch('/api/field-intake/hydration/retry', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          workspaceId: effectiveWorkspaceId ?? undefined,
          fieldId: job.fieldId,
          fieldName: job.fieldLabel,
          fieldAction: job.fieldAction,
          cropType: job.cropType ?? undefined,
          legalLandDescriptions:
            job.legalLandDescriptions && job.legalLandDescriptions.length > 0
              ? job.legalLandDescriptions
              : undefined,
        }),
      });

      const result = await readAddFieldApiResult<HydrationRetryPayload>(response);
      const nextTrackedJobs = buildTrackedJobs(
        result.onboardingDispatches,
        new Map([[job.fieldId, job.fieldLabel]]),
        new Map([
          [
            job.fieldId,
            {
              fieldAction: job.fieldAction,
              cropType: job.cropType ?? null,
              legalLandDescriptions: job.legalLandDescriptions,
            },
          ],
        ]),
      );

      setTrackedJobs((current) => [
        ...current.filter((entry) => entry.fieldId !== job.fieldId),
        ...nextTrackedJobs,
      ]);
      setStatusTone(result.replayResult?.action === 'replayed' ? 'positive' : 'neutral');
      setStatusText(
        `${job.fieldLabel}: ${describeHydrationReplayResult(result.replayResult)}`,
      );
      setRetryAction(null);
      onOnboardingTracked?.({
        preferredFieldId: job.fieldId,
        fieldIds: [job.fieldId],
        fieldEntries: [{ fieldId: job.fieldId, fieldName: job.fieldLabel }],
        dispatchIds: Array.from(new Set(nextTrackedJobs.map((entry) => entry.dispatchId))),
        workspaceId: effectiveWorkspaceId,
        trackedJobs: nextTrackedJobs.map((entry) => ({
          dispatchId: entry.dispatchId,
          fieldId: entry.fieldId,
          fieldLabel: entry.fieldLabel,
        })),
      });
    } catch (error) {
      setStatusTone('danger');
      setStatusText(describeAddFieldApiError(error));
    } finally {
      setIsSubmitting(false);
      setRetryingHydrationFieldId(null);
      setRetryingHydrationFieldLabel(null);
    }
  };

  const retryLabel = resolveAddFieldRetryLabel(retryAction);

  return (
    <div className="fdp" style={{ position: 'absolute', top: 'var(--space-lg)', right: 'var(--space-lg)', bottom: 'var(--space-xl)' }}>
      <div className="fdp__header">
        <div className="fdp__header-top">
          <div>
            <h1 className="fdp__field-name">Add Field</h1>
            <p className="fdp__field-meta">Define a new field boundary and assign crop context</p>
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

      <div style={{
        flex: 1, overflowY: 'auto', padding: '6px 16px 16px',
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, alignContent: 'start',
      }}>
        {/* ── Method switcher (horizontal chips) ── */}
        <div style={{
          gridColumn: '1 / -1', display: 'flex', gap: 2,
          background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 3,
        }}>
          {METHODS.map((entry) => {
            const active = method === entry.key;
            return (
              <button
                key={entry.key}
                type="button"
                onClick={() => handleMethodSelect(entry.key)}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 6, padding: '8px 4px 10px', border: 'none', cursor: 'pointer',
                  borderRadius: 8, transition: 'all 250ms cubic-bezier(.2,.8,.2,1)',
                  background: active ? 'var(--surface-white)' : 'transparent',
                  boxShadow: active ? '0 1px 3px rgba(0,0,0,0.07)' : 'none',
                }}
              >
                <entry.icon size={14} style={{
                  color: active ? 'var(--primary-green)' : 'var(--text-muted)',
                  transition: 'color 200ms ease',
                }} />
                <span style={{
                  fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: active ? 700 : 400,
                  color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                  letterSpacing: '0.3px', transition: 'all 200ms ease',
                }}>
                  {entry.label}
                </span>
              </button>
            );
          })}
        </div>

        {method === 'lld' && (
          <>
            <Card span={-1} style={{ gap: 16 }}>
              <Lbl>FIELD IDENTITY</Lbl>
              <FieldInput label="Field Name" placeholder="e.g. North Quarter A" value={fieldName} onChange={setFieldName} />
              <FieldInput
                label="Legal Land Description"
                placeholder="e.g. SE 25-010-17 W4M"
                value={lldCode}
                onChange={(value) => {
                  setLldCode(value);
                  setLldDraftReady(false);
                }}
              />
            </Card>
            <Card span={-1} style={{ gap: 16 }}>
              <Lbl>CROP ASSIGNMENT</Lbl>
              <FieldInput label="Crop Type" placeholder="e.g. Canola" value={cropType} onChange={setCropType} />
              <FieldInput label="Variety" placeholder="e.g. InVigor L233P" value={variety} onChange={setVariety} />
              <FieldDateInput label="Seeding Date" placeholder="Select date…" value={seedingDate} onChange={setSeedingDate} />
            </Card>
          </>
        )}

        {method === 'csv' && (
          <Card span={-1} style={{ gap: 16 }}>
            <Lbl>SPREADSHEET IMPORT</Lbl>
            <Sub>Upload a CSV or Excel file with field names, LLDs, crop types, and areas. The panel now previews and can commit spreadsheet imports.</Sub>
            <DropZone
              label="Drop CSV or Excel file here"
              accept=".csv,.xlsx,.xls"
              selectedFile={selectedFile}
              onFileSelect={(file) => {
                setSelectedFile(file);
                setSpreadsheetPreview(null);
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Sub>Required columns:</Sub>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {['Field Name', 'LLD', 'Crop', 'Area (ha)'].map((column) => (
                  <span key={column} className="fdp__chip" style={{ fontSize: 9 }}>{column}</span>
                ))}
              </div>
            </div>
          </Card>
        )}

        {method === 'kml' && (
          <Card span={-1} style={{ gap: 16 }}>
            <Lbl>BOUNDARY IMPORT</Lbl>
            <Sub>Upload a KML, KMZ, GeoJSON, or Shapefile. Field boundaries are parsed through the existing intake route and returned as a draft preview.</Sub>
            <DropZone
              label="Drop boundary file here"
              accept=".kml,.kmz,.geojson,.shp,.zip"
              selectedFile={selectedFile}
              onFileSelect={(file) => {
                setSelectedFile(file);
                setBoundaryDraftReady(false);
              }}
            />
            <Card className="fdp-card--muted" style={{ gap: 4 }}>
              <Sub>Supported formats:</Sub>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {['KML', 'KMZ', 'GeoJSON', 'Shapefile (.zip)'].map((format) => (
                  <span key={format} className="fdp__chip" style={{ fontSize: 9 }}>{format}</span>
                ))}
              </div>
            </Card>
          </Card>
        )}



        {statusText ? (
          <Card span={-1} accent={statusTone === 'danger' ? '#ef4444' : statusTone === 'positive' ? 'var(--primary-green)' : undefined}>
            <Sub>{statusText}</Sub>
            {statusTone === 'danger' && retryLabel ? (
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 4 }}>
                <button
                  type="button"
                  onClick={handleRetryAction}
                  disabled={isSubmitting}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 10,
                    border: '1px solid rgba(239,68,68,0.25)',
                    background: 'rgba(239,68,68,0.08)',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-body)',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    opacity: isSubmitting ? 0.6 : 1,
                  }}
                >
                  {retryLabel}
                </button>
              </div>
            ) : null}
          </Card>
        ) : null}

        {previewCard ? <PreviewSummaryCard preview={previewCard} tone={statusTone} /> : null}
        <JobStatusCard
          trackedJobs={trackedJobs}
          jobStatuses={jobStatuses}
          onRetryHydration={handleRetryHydration}
          retryingFieldId={retryingHydrationFieldId}
        />
        {method === 'csv' && spreadsheetPreview && spreadsheetPreview.issues.length > 0 ? (
          <SpreadsheetIssuesCard issues={spreadsheetPreview.issues} />
        ) : null}

        {/* ── Progress context during long operations ── */}
        {isSubmitting && (
          <Card span={-1} className="fdp-card--muted" style={{ gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 12, height: 12, border: '2px solid rgba(255,255,255,0.15)',
                borderTopColor: 'var(--primary-green)', borderRadius: '50%',
                animation: 'fdp-spinner 600ms linear infinite', flexShrink: 0,
              }} />
              <Sub>
                {isRetryingHydration && `Retrying hydration for ${retryingHydrationFieldLabel ?? 'that field'}…`}
                {!isRetryingHydration && method === 'lld' && !lldDraftReady && 'Searching land description databases…'}
                {!isRetryingHydration && method === 'lld' && lldDraftReady && 'Creating field boundary and queuing satellite analysis…'}
                {!isRetryingHydration && method === 'csv' && !spreadsheetPreview && 'Parsing spreadsheet and validating field data…'}
                {!isRetryingHydration && method === 'csv' && spreadsheetPreview && 'Creating fields, resolving boundaries, and queuing satellite onboarding…'}
                {!isRetryingHydration && method === 'kml' && !boundaryDraftReady && 'Parsing boundary geometry from file…'}
                {!isRetryingHydration && method === 'kml' && boundaryDraftReady && 'Creating field from boundary and queuing analysis…'}
              </Sub>
            </div>
            <Sub>
              {isRetryingHydration && 'We are replaying field hydration context and queuing a fresh onboarding run.'}
              {!isRetryingHydration && method === 'csv' && !spreadsheetPreview && 'This usually takes 5–15 seconds depending on file size.'}
              {!isRetryingHydration && method === 'csv' && spreadsheetPreview && `Importing ${spreadsheetPreview.fieldCount} fields — this may take up to a minute.`}
              {!isRetryingHydration && method === 'lld' && 'LLD lookups typically resolve within a few seconds.'}
              {!isRetryingHydration && method === 'kml' && 'Boundary parsing depends on file complexity.'}
            </Sub>
          </Card>
        )}

        <ActionButtons
          onClose={onClose}
          label={primaryLabel}
          onPrimaryClick={handlePrimaryAction}
          disabled={primaryDisabled}
          busy={isSubmitting && !isRetryingHydration}
        />
      </div>
    </div>
  );
}

function ActionButtons({
  onClose,
  label,
  onPrimaryClick,
  disabled,
  busy,
}: {
  onClose?: () => void;
  label: string;
  onPrimaryClick: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
      <button type="button" onClick={onPrimaryClick} disabled={disabled || busy} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: '12px 28px', borderRadius: 10, border: 'none',
        background: disabled ? 'rgba(255,255,255,0.12)' : 'var(--btn-fill-primary)',
        color: '#fff', position: 'relative', overflow: 'hidden',
        fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700,
        cursor: disabled || busy ? 'not-allowed' : 'pointer',
        boxShadow: disabled ? 'none' : '0 4px 0 var(--color-forest-950)',
        opacity: disabled ? 0.6 : 1,
        transition: 'all 150ms cubic-bezier(.2,.8,.2,1)',
      }}>
        {busy ? (
          <>
            <span style={{
              width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)',
              borderTopColor: '#fff', borderRadius: '50%',
              animation: 'fdp-spinner 600ms linear infinite',
            }} />
            {label}…
            {/* Indeterminate progress shimmer */}
            <span style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)',
              animation: 'fdp-btn-shimmer 1.5s ease-in-out infinite',
            }} />
          </>
        ) : (
          <><Plus size={16} /> {label}</>
        )}
      </button>
      {onClose && (
        <button type="button" onClick={onClose} style={{
          padding: '10px', borderRadius: 10, border: 'none', background: 'transparent',
          fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600,
          color: 'var(--text-muted)', cursor: 'pointer',
        }}>Cancel</button>
      )}
    </div>
  );
}
