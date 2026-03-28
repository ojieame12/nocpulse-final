"use client";

import { useState } from "react";

/* ── Types ── */

type Outcome = "confirmed" | "not_confirmed" | "resolved" | "monitor";

type NoteEntry = {
  id: string;
  date: string;
  text: string;
  status: Outcome;
};

/* ── Options ── */

const OUTCOME_OPTIONS: {
  value: Outcome;
  label: string;
  description: string;
  color: string;
  icon: string;
}[] = [
  {
    value: "confirmed",
    label: "Confirmed",
    description: "Stress or damage is visible in the field",
    color: "#ef4444",
    icon: "circle-alert",
  },
  {
    value: "not_confirmed",
    label: "Not Confirmed",
    description: "Issue not visible from the ground",
    color: "#6b7280",
    icon: "circle-x",
  },
  {
    value: "resolved",
    label: "Resolved",
    description: "Issue was present but has been managed",
    color: "#16a34a",
    icon: "circle-check",
  },
  {
    value: "monitor",
    label: "Monitor",
    description: "Inconclusive. Check again on next capture",
    color: "#f59e0b",
    icon: "eye",
  },
];

/* ── Demo data ── */

const DEMO_NOTES: NoteEntry[] = [
  {
    id: "n1",
    date: "2026-03-22T10:30:00Z",
    text: "Yellowing visible along east drainage. Soil compacted from recent rain. Recommend tile drainage assessment.",
    status: "confirmed",
  },
  {
    id: "n2",
    date: "2026-03-15T14:15:00Z",
    text: "Applied fungicide to west section. Crop recovering well. NDVI trending back up since treatment.",
    status: "resolved",
  },
];

/* ── Helpers ── */

function formatNoteDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function badgeClass(status: Outcome): string {
  if (status === "confirmed") return "nt__badge nt__badge--confirmed";
  if (status === "resolved") return "nt__badge nt__badge--resolved";
  return "nt__badge";
}

/* ── Lucide-style icon SVGs ── */

function OutcomeIcon({ icon, color }: { icon: string; color: string }) {
  const props = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (icon === "circle-alert")
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    );

  if (icon === "circle-x")
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="10" />
        <path d="m15 9-6 6" />
        <path d="m9 9 6 6" />
      </svg>
    );

  if (icon === "circle-check")
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="10" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    );

  if (icon === "eye")
    return (
      <svg {...props}>
        <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );

  return null;
}

/* ── Component ── */

export function NotesTab() {
  const [selectedOutcome, setSelectedOutcome] = useState<Outcome | null>(
    "confirmed"
  );
  const [scoutNotes, setScoutNotes] = useState("");

  return (
    <div className="nt__root">
      {/* ── 1. Field Title Block ── */}
      <div className="nt__title-block">
        <h2 className="nt__field-name">Quarter SE 25 010 17 W4</h2>
        <span className="nt__subtitle">
          SE 25-010-17 W4M &middot; Legal Land Description
        </span>
      </div>

      {/* ── 2. Inspection Target Card ── */}
      <div className="nt__target-card">
        <div className="nt__target-header">
          <span className="nt__target-label">Inspection Target</span>
          <span className="nt__target-date">Mar 26 capture</span>
        </div>
        <div className="nt__target-name">
          East Corner &middot; Possible waterlogging
        </div>
        <div className="nt__target-coords">
          52.1842&deg;N, &minus;110.6398&deg;W
        </div>
      </div>

      {/* ── 3. "What did you find?" ── */}
      <h3 className="nt__heading">What did you find?</h3>

      {/* ── 4. Outcome Choice Cards ── */}
      <div className="nt__radio-group">
        {OUTCOME_OPTIONS.map((opt) => {
          const isSelected = selectedOutcome === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSelectedOutcome(opt.value)}
              className={`nt__radio-card ${isSelected ? "nt__radio-card--selected" : ""}`}
              style={
                isSelected
                  ? { borderColor: opt.color }
                  : undefined
              }
            >
              {/* Icon */}
              <OutcomeIcon icon={opt.icon} color={isSelected ? opt.color : "#6b7280"} />

              {/* Text */}
              <div className="nt__radio-text">
                <div className="nt__option-label">{opt.label}</div>
                <div className="nt__option-desc">{opt.description}</div>
              </div>

              {/* Selection indicator */}
              {isSelected && (
                <span
                  className="nt__radio-dot"
                  style={{ background: opt.color }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ── 5. Scout Notes ── */}
      <div className="nt__notes-field">
        <label htmlFor="scout-notes" className="nt__scout-label">
          Scout Notes
        </label>
        <textarea
          id="scout-notes"
          className="nt__textarea"
          placeholder="Describe what you observed in the field..."
          value={scoutNotes}
          onChange={(e) => setScoutNotes(e.target.value)}
        />
      </div>

      {/* ── 6. Submit Button ── */}
      <button type="button" className="nt__submit">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0 }}
        >
          <path d="m22 2-7 20-4-9-9-4z" />
          <path d="M22 2 11 13" />
        </svg>
        Submit Scout Report
      </button>

      {/* ── 7. Edit link ── */}
      <div className="nt__edit-section">
        <button type="button" className="nt__edit-link">
          Edit previous entries
        </button>
      </div>

      {/* ── 8. Field Notes History ── */}
      <div className="nt__history">
        <div className="nt__history-header">
          Field notes ({DEMO_NOTES.length})
        </div>
        {DEMO_NOTES.map((note) => {
          const meta = OUTCOME_OPTIONS.find((o) => o.value === note.status);
          return (
            <div key={note.id} className="nt__history-card">
              <div className="nt__history-top">
                <span className="nt__history-date">
                  {formatNoteDate(note.date)}
                </span>
                <span className={badgeClass(note.status)}>
                  {meta?.label}
                </span>
              </div>
              <p className="nt__history-text">{note.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
