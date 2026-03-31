'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Trash2, MapPin, Leaf, Ruler, Calendar, Activity, ChevronDown } from 'lucide-react';

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

/* ── Inline editable row ── */

function EditableRow({
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

  function commit() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value && onCommit) {
      onCommit(trimmed);
    }
    setEditing(false);
  }

  return (
    <div className="edit-field__row">
      <div className="edit-field__row-label">
        {Icon && <Icon size={12} className="edit-field__row-icon" />}
        <span>{label}</span>
      </div>
      {editing ? (
        <input
          ref={inputRef}
          className="edit-field__row-input"
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
        <button
          type="button"
          className={`edit-field__row-value${mono ? ' edit-field__row-value--mono' : ''}${!value ? ' edit-field__row-value--empty' : ''}`}
          onClick={() => {
            if (onCommit) {
              setDraft(value);
              setEditing(true);
            }
          }}
          style={onCommit ? { cursor: 'text' } : { cursor: 'default' }}
        >
          {value || placeholder || '—'}
        </button>
      )}
    </div>
  );
}

/* ── Read-only stat row ── */

function StatRow({ label, value, icon: Icon }: { label: string; value: string; icon?: typeof MapPin }) {
  return (
    <div className="edit-field__row">
      <div className="edit-field__row-label">
        {Icon && <Icon size={12} className="edit-field__row-icon" />}
        <span>{label}</span>
      </div>
      <span className="edit-field__row-value edit-field__row-value--mono">{value || '—'}</span>
    </div>
  );
}

/* ── Section header ── */

function SectionHeader({ label, icon: Icon }: { label: string; icon?: typeof MapPin }) {
  return (
    <div className="edit-field__section-header">
      {Icon && <Icon size={13} className="edit-field__section-icon" />}
      <span>{label}</span>
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

  /* Reset local state when field changes */
  useEffect(() => {
    setLocalName(fieldName);
    setDeleteConfirm(false);
  }, [fieldId, fieldName]);

  return (
    <div className="edit-field">
      {/* ── Header ── */}
      <div className="edit-field__header">
        <div className="edit-field__header-top">
          <div className="edit-field__header-titles">
            <span className="edit-field__header-label">Edit field</span>
            <h2 className="edit-field__header-name">{localName}</h2>
          </div>
          <button
            type="button"
            className="edit-field__close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="edit-field__body">

        {/* ── Field identity ── */}
        <div className="edit-field__section">
          <SectionHeader label="Field details" icon={MapPin} />
          <EditableRow
            label="Name"
            value={localName}
            onCommit={(v) => {
              setLocalName(v);
              onRename?.(fieldId, v);
            }}
          />
          <EditableRow
            label="Legal land description"
            value={lld ?? ''}
            placeholder="e.g. NE-25-010-17-W4"
            mono
            onCommit={onUpdateLld ? (v) => onUpdateLld(fieldId, v) : undefined}
          />
          <StatRow label="Area" value={areaHaLabel} icon={Ruler} />
        </div>

        {/* ── Crop context ── */}
        <div className="edit-field__section">
          <SectionHeader label="Crop" icon={Leaf} />
          <EditableRow
            label="Crop type"
            value={crop ?? ''}
            placeholder="e.g. Canola"
            onCommit={onUpdateCrop ? (v) => onUpdateCrop(fieldId, { cropName: v }) : undefined}
          />
          <StatRow label="Stage" value={cropStage ?? '—'} icon={Activity} />
          {growthStageLabel ? (
            <StatRow label="Growth stage" value={growthStageLabel} />
          ) : null}
          {accumulatedGdd ? (
            <StatRow label="Accumulated GDD" value={accumulatedGdd} icon={Calendar} />
          ) : null}
        </div>

        {/* ── Danger zone ── */}
        {onDelete && (
          <div className="edit-field__danger">
            <div className="edit-field__danger-separator" />
            <span className="edit-field__danger-label">Danger zone</span>
            {deleteConfirm ? (
              <div className="edit-field__danger-confirm">
                <p className="edit-field__danger-warning">
                  This will permanently remove <strong>{localName}</strong> and all
                  associated data. This cannot be undone.
                </p>
                <div className="edit-field__danger-actions">
                  <button
                    type="button"
                    className="edit-field__danger-btn edit-field__danger-btn--delete"
                    onClick={() => {
                      onDelete(fieldId);
                    }}
                  >
                    <Trash2 size={12} />
                    Delete permanently
                  </button>
                  <button
                    type="button"
                    className="edit-field__danger-btn edit-field__danger-btn--cancel"
                    onClick={() => setDeleteConfirm(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="edit-field__danger-btn edit-field__danger-btn--trigger"
                onClick={() => setDeleteConfirm(true)}
              >
                <Trash2 size={12} />
                Delete field
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
