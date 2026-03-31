'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Trash2, MapPin, Leaf, Ruler, Calendar, Activity, Pencil, Download } from 'lucide-react';

/* ── Types ── */

export interface EditFieldPanelProps {
  fieldId: string;
  fieldName: string;
  areaHaLabel: string;
  lld: string | null;
  crop: string | null;
  cropStage: string | null;
  growthStageLabel: string | null;
  accumulatedGdd: string | null;
  onClose: () => void;
  onRename?: (fieldId: string, newName: string) => void;
  onUpdateLld?: (fieldId: string, lld: string) => void;
  onUpdateCrop?: (
    fieldId: string,
    crop: { cropName: string; variety?: string; seedingDate?: string },
  ) => void;
  onDelete?: (fieldId: string) => void;
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
  cropStage,
  growthStageLabel,
  accumulatedGdd,
  onClose,
  onRename,
  onUpdateLld,
  onUpdateCrop,
  onDelete,
}: EditFieldPanelProps) {
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [localName, setLocalName] = useState(fieldName);

  useEffect(() => {
    setLocalName(fieldName);
    setDeleteConfirm(false);
  }, [fieldId, fieldName]);

  return (
    <div className="fdp">
      {/* ── Header ── */}
      <div className="fdp__header">
        <div className="fdp__header-top">
          <div>
            <span className="fdp-lbl fdp-lbl--muted" style={{ fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Edit Field</span>
            <h2 className="fdp__field-name" style={{ fontSize: 17, marginTop: 2 }}>{localName}</h2>
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
            <StatRow label="Stage" value={cropStage ?? '—'} icon={Activity} />
            {growthStageLabel && <StatRow label="Growth stage" value={growthStageLabel} />}
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
        {onDelete && (
          <div className="fdp-card fdp-card--span-full fdp-edit__danger-card">
            <div className="fdp-edit__card-header fdp-edit__card-header--danger">
              <Trash2 size={13} strokeWidth={2.2} />
              <span className="fdp-lbl" style={{ letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: 10.5 }}>Danger Zone</span>
            </div>
            {deleteConfirm ? (
              <div className="fdp-edit__danger-confirm">
                <p className="fdp-edit__danger-text">
                  Permanently remove <strong>{localName}</strong> and all associated data. This cannot be undone.
                </p>
                <div className="fdp-edit__danger-btns">
                  <button
                    type="button"
                    className="fdp-edit__danger-btn fdp-edit__danger-btn--confirm"
                    onClick={() => onDelete(fieldId)}
                  >
                    <Trash2 size={11} />
                    Delete permanently
                  </button>
                  <button
                    type="button"
                    className="fdp-edit__danger-btn fdp-edit__danger-btn--cancel"
                    onClick={() => setDeleteConfirm(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="fdp-edit__danger-btn fdp-edit__danger-btn--trigger"
                onClick={() => setDeleteConfirm(true)}
              >
                <Trash2 size={11} />
                Delete this field…
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
