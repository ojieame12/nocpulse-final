'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Trash2, MapPin, Leaf, Ruler, Calendar, Activity, Pencil, Download } from 'lucide-react';

const AUTO_GROWTH_STAGE_VALUE = "__auto__";
const GROWTH_STAGE_OPTIONS = [
  { value: "pre-seed", label: "Pre Seed" },
  { value: "vegetative", label: "Vegetative" },
  { value: "flowering", label: "Flowering" },
  { value: "ripening", label: "Ripening" },
] as const;

function normalizeGrowthStageValue(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";

  switch (normalized) {
    case "pre-seed":
    case "preseed":
    case "seed":
    case "emergence":
      return "pre-seed";
    case "vegetative":
    case "veg":
      return "vegetative";
    case "flowering":
    case "heading":
    case "reproductive":
      return "flowering";
    case "ripening":
    case "maturity":
    case "harvest":
      return "ripening";
    default:
      return null;
  }
}

/* ── Types ── */

export interface EditFieldPanelProps {
  fieldId: string;
  fieldName: string;
  areaHaLabel: string;
  lld: string | null;
  crop: string | null;
  seedingDate: string | null;
  cropStage: string | null;
  growthStageKey: string | null;
  growthStageSource: string | null;
  growthStageLabel: string | null;
  accumulatedGdd: string | null;
  mutationNotice?: string | null;
  onClose: () => void;
  onRename?: (fieldId: string, newName: string) => void;
  onUpdateLld?: (fieldId: string, lld: string) => void;
  onUpdateCrop?: (
    fieldId: string,
    crop: { cropName: string; variety?: string; seedingDate?: string; growthStage?: string | null },
  ) => Promise<boolean> | boolean | void;
  onArchive?: (fieldId: string) => void;
  onDeletePermanently?: (fieldId: string) => void;
}

/* ── Inline editable field ── */

function InlineEdit({
  label,
  value,
  placeholder,
  onCommit,
  icon: Icon,
  mono = false,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onCommit?: (value: string) => void;
  icon?: typeof MapPin;
  mono?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => { setDraft(value); }, [value]);

  function commit() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value && onCommit) {
      onCommit(trimmed);
    }
    setEditing(false);
  }

  const editable = !!onCommit;

  return (
    <div className="fdp-edit__row">
      <div className="fdp-edit__row-label">
        {Icon && <Icon size={11} strokeWidth={2.2} />}
        <span>{label}</span>
      </div>
      {editing ? (
        <input
          ref={inputRef}
          className={`fdp-edit__row-input${mono ? ' fdp-edit__row-input--mono' : ''}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') { setDraft(value); setEditing(false); }
          }}
          onBlur={commit}
          placeholder={placeholder}
        />
      ) : (
        <div
          className={`fdp-edit__row-value${mono ? ' fdp-edit__row-value--mono' : ''}${!value ? ' fdp-edit__row-value--empty' : ''}${editable ? ' fdp-edit__row-value--editable' : ''}`}
          onClick={editable ? () => { setDraft(value); setEditing(true); } : undefined}
          role={editable ? "button" : undefined}
          tabIndex={editable ? 0 : undefined}
          onKeyDown={editable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { setDraft(value); setEditing(true); } } : undefined}
        >
          <span>{value || placeholder || '—'}</span>
          {editable && <Pencil size={10} strokeWidth={2} className="fdp-edit__row-pencil" />}
        </div>
      )}
    </div>
  );
}

/* ── Read-only stat ── */

function StatRow({ label, value, icon: Icon }: { label: string; value: string; icon?: typeof MapPin }) {
  return (
    <div className="fdp-edit__row">
      <div className="fdp-edit__row-label">
        {Icon && <Icon size={11} strokeWidth={2.2} />}
        <span>{label}</span>
      </div>
      <span className="fdp-edit__row-value fdp-edit__row-value--mono">{value || '—'}</span>
    </div>
  );
}

/* ── Component ── */

export function EditFieldPanel({
  fieldId,
  fieldName,
  areaHaLabel,
  lld,
  crop,
  seedingDate,
  cropStage,
  growthStageKey,
  growthStageSource,
  growthStageLabel,
  accumulatedGdd,
  mutationNotice = null,
  onClose,
  onRename,
  onUpdateLld,
  onUpdateCrop,
  onArchive,
  onDeletePermanently,
}: EditFieldPanelProps) {
  const [dangerIntent, setDangerIntent] = useState<"archive" | "delete" | null>(null);
  const [localName, setLocalName] = useState(fieldName);
  const normalizedGrowthStage = normalizeGrowthStageValue(growthStageKey);
  const [selectedSeedingDate, setSelectedSeedingDate] = useState(seedingDate ?? "");
  const [selectedGrowthStage, setSelectedGrowthStage] = useState<string>(
    growthStageSource === "manual" && normalizedGrowthStage
      ? normalizedGrowthStage
      : AUTO_GROWTH_STAGE_VALUE,
  );
  const [growthStageSaving, setGrowthStageSaving] = useState(false);
  const [seedingDateSaving, setSeedingDateSaving] = useState(false);
  const trimmedCrop = crop?.trim() ?? "";

  useEffect(() => {
    setLocalName(fieldName);
    setDangerIntent(null);
  }, [fieldId, fieldName]);

  useEffect(() => {
    setSelectedSeedingDate(seedingDate ?? "");
    setSelectedGrowthStage(
      growthStageSource === "manual" && normalizedGrowthStage
        ? normalizedGrowthStage
        : AUTO_GROWTH_STAGE_VALUE,
    );
    setGrowthStageSaving(false);
    setSeedingDateSaving(false);
  }, [fieldId, growthStageSource, normalizedGrowthStage, seedingDate]);

  async function handleSeedingDateChange(nextValue: string) {
    if (!onUpdateCrop || !trimmedCrop || seedingDateSaving) {
      return;
    }

    const previousValue = selectedSeedingDate;
    setSelectedSeedingDate(nextValue);
    setSeedingDateSaving(true);

    try {
      const result = await onUpdateCrop(fieldId, {
        cropName: trimmedCrop,
        seedingDate: nextValue,
      });

      if (result === false) {
        setSelectedSeedingDate(previousValue);
      }
    } finally {
      setSeedingDateSaving(false);
    }
  }

  async function handleGrowthStageChange(nextValue: string) {
    if (!onUpdateCrop || !trimmedCrop || growthStageSaving) {
      return;
    }

    const previousValue = selectedGrowthStage;
    setSelectedGrowthStage(nextValue);
    setGrowthStageSaving(true);

    try {
      const result = await onUpdateCrop(fieldId, {
        cropName: trimmedCrop,
        growthStage: nextValue === AUTO_GROWTH_STAGE_VALUE ? null : nextValue,
      });

      if (result === false) {
        setSelectedGrowthStage(previousValue);
      }
    } finally {
      setGrowthStageSaving(false);
    }
  }

  return (
    <div className="fdp">
      {/* ── Header ── */}
      <div className="fdp__header">
        <div className="fdp__header-top">
          <div>
            <span className="fdp-lbl fdp-lbl--muted" style={{ fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Edit Field</span>
            <h2 className="fdp__field-name" style={{ fontSize: 17, marginTop: 2 }}>{localName}</h2>
            {mutationNotice ? (
              <p style={{ marginTop: 6, maxWidth: 260, fontSize: 11, lineHeight: 1.5, color: 'var(--text-muted)' }}>
                {mutationNotice}
              </p>
            ) : null}
          </div>
          <button type="button" className="fdp__close" onClick={onClose} aria-label="Close">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="fdp__body">

        {/* ── Field identity card ── */}
        <div className="fdp-card fdp-card--span-full">
          <div className="fdp-edit__card-header">
            <MapPin size={13} strokeWidth={2.2} />
            <span className="fdp-lbl" style={{ letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: 10.5 }}>Field Details</span>
          </div>
          <div className="fdp-edit__rows">
            <InlineEdit
              label="Name"
              value={localName}
              onCommit={(v) => { setLocalName(v); onRename?.(fieldId, v); }}
            />
            <InlineEdit
              label="Legal land"
              value={lld ?? ''}
              placeholder="e.g. NE-25-010-17-W4"
              mono
              onCommit={onUpdateLld ? (v) => onUpdateLld(fieldId, v) : undefined}
              icon={MapPin}
            />
            <StatRow label="Area" value={areaHaLabel} icon={Ruler} />
          </div>
        </div>

        {/* ── Crop context card ── */}
        <div className="fdp-card fdp-card--span-full">
          <div className="fdp-edit__card-header">
            <Leaf size={13} strokeWidth={2.2} />
            <span className="fdp-lbl" style={{ letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: 10.5 }}>Crop Context</span>
          </div>
          <div className="fdp-edit__rows">
            <InlineEdit
              label="Crop type"
              value={crop ?? ''}
              placeholder="e.g. Canola"
              onCommit={onUpdateCrop ? (v) => onUpdateCrop(fieldId, { cropName: v }) : undefined}
              icon={Leaf}
            />
            <div className="fdp-edit__row">
              <div className="fdp-edit__row-label">
                <Calendar size={11} strokeWidth={2.2} />
                <span>Seeding date</span>
              </div>
              <input
                type="date"
                className="fdp-edit__row-input"
                value={selectedSeedingDate}
                onChange={(event) => {
                  void handleSeedingDateChange(event.target.value);
                }}
                disabled={!onUpdateCrop || !trimmedCrop || seedingDateSaving}
                aria-label="Seeding date"
              />
            </div>
            <StatRow label="Stage" value={cropStage ?? '—'} icon={Activity} />
            <div className="fdp-edit__row">
              <div className="fdp-edit__row-label">
                <Activity size={11} strokeWidth={2.2} />
                <span>Growth stage</span>
              </div>
              <select
                className="fdp-edit__row-input"
                value={selectedGrowthStage}
                onChange={(event) => {
                  void handleGrowthStageChange(event.target.value);
                }}
                disabled={!onUpdateCrop || !trimmedCrop || growthStageSaving}
                aria-label="Growth stage override"
              >
                <option value={AUTO_GROWTH_STAGE_VALUE}>
                  {growthStageSource === "manual"
                    ? "Auto (clear manual override)"
                    : "Auto (use current derived stage)"}
                </option>
                {GROWTH_STAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            {growthStageLabel && (
              <StatRow
                label="Stage basis"
                value={
                  growthStageSource === "manual"
                    ? `${growthStageLabel} · manual`
                    : growthStageLabel
                }
              />
            )}
            {accumulatedGdd && <StatRow label="GDD accumulated" value={accumulatedGdd} icon={Calendar} />}
          </div>
        </div>

        {/* ── Quick actions card ── */}
        <div className="fdp-card fdp-card--span-full">
          <div className="fdp-edit__card-header">
            <Download size={13} strokeWidth={2.2} />
            <span className="fdp-lbl" style={{ letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: 10.5 }}>Quick Actions</span>
          </div>
          <div className="fdp-edit__actions">
            <a
              className="fdp-edit__action-btn"
              href={`/api/fields/${fieldId}/report-export`}
              download
            >
              <Download size={12} />
              Export Field Report (PDF)
            </a>
          </div>
        </div>

        {/* ── Danger zone ── */}
        {(onArchive || onDeletePermanently) && (
          <div className="fdp-card fdp-card--span-full fdp-edit__danger-card">
            <div className="fdp-edit__card-header fdp-edit__card-header--danger">
              <Trash2 size={13} strokeWidth={2.2} />
              <span className="fdp-lbl" style={{ letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: 10.5 }}>Danger Zone</span>
            </div>
            <div className="fdp-edit__danger-summary">
              <p className="fdp-edit__danger-text">
                Archive removes <strong>{localName}</strong> from the active workspace view without immediately wiping the underlying record.
              </p>
              <ul className="fdp-edit__danger-list">
                <li>The field disappears from the strip, map, reports, alerts, and notes.</li>
                <li>Archive keeps the field row and linked agronomic history in the database.</li>
                <li>Permanent delete also removes the field record and detaches import batch history.</li>
              </ul>
            </div>
            {dangerIntent ? (
              <div className="fdp-edit__danger-confirm">
                <p className="fdp-edit__danger-text">
                  {dangerIntent === "archive" ? (
                    <>
                      Archive <strong>{localName}</strong> and remove it from the active workspace flow.
                    </>
                  ) : (
                    <>
                      Permanently remove <strong>{localName}</strong> and all associated data. This cannot be undone.
                    </>
                  )}
                </p>
                <div className="fdp-edit__danger-btns">
                  {dangerIntent === "archive" ? (
                    <button
                      type="button"
                      className="fdp-edit__danger-btn fdp-edit__danger-btn--archive"
                      onClick={() => onArchive?.(fieldId)}
                    >
                      <Trash2 size={11} />
                      Archive field
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="fdp-edit__danger-btn fdp-edit__danger-btn--confirm"
                      onClick={() => onDeletePermanently?.(fieldId)}
                    >
                      <Trash2 size={11} />
                      Delete permanently
                    </button>
                  )}
                  <button
                    type="button"
                    className="fdp-edit__danger-btn fdp-edit__danger-btn--cancel"
                    onClick={() => setDangerIntent(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="fdp-edit__danger-btns">
                {onArchive && (
                  <button
                    type="button"
                    className="fdp-edit__danger-btn fdp-edit__danger-btn--archive-trigger"
                    onClick={() => setDangerIntent("archive")}
                  >
                    <Trash2 size={11} />
                    Archive this field…
                  </button>
                )}
                {onDeletePermanently && (
                  <button
                    type="button"
                    className="fdp-edit__danger-btn fdp-edit__danger-btn--trigger"
                    onClick={() => setDangerIntent("delete")}
                  >
                    <Trash2 size={11} />
                    Delete permanently…
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
