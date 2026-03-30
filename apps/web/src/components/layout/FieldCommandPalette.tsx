"use client";

import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import type { SidebarFieldItem } from "./Sidebar";

/* ── Result types ── */

export type PaletteFieldResult = {
  kind: "field";
  id: string;
  name: string;
  crop?: string;
  area: string;
  status?: string;
  legalLandDescription?: string | null;
};

export type PaletteZoneResult = {
  kind: "zone";
  fieldId: string;
  fieldName: string;
  zoneId: string;
  family: string;
  trackingKey: string;
  status: string;
  severity: string | null;
};

export type PaletteFindingResult = {
  kind: "finding";
  fieldId: string;
  fieldName: string;
  findingId: string;
  title: string;
  summary: string | null;
  severity: string;
};

export type PaletteResult =
  | PaletteFieldResult
  | PaletteZoneResult
  | PaletteFindingResult;

/* ── Search index (pass from parent) ── */

export type PaletteSearchIndex = {
  fields: PaletteFieldResult[];
  zones: PaletteZoneResult[];
  findings: PaletteFindingResult[];
};

/* ── Props ── */

export type FieldCommandPaletteProps = {
  open: boolean;
  onClose: () => void;
  onSelectField?: (fieldId: string) => void;
  onSelectZone?: (fieldId: string, zoneId: string) => void;
  onSelectFinding?: (fieldId: string, findingId: string) => void;
  searchIndex: PaletteSearchIndex;
};

/* ── Fuzzy match — simple substring on lowered terms ── */

function fuzzyMatch(query: string, ...targets: (string | null | undefined)[]): boolean {
  const q = query.toLowerCase();
  return targets.some((t) => t && t.toLowerCase().includes(q));
}

/* ── Severity dot color ── */

const SEVERITY_CLASSES: Record<string, string> = {
  critical: "field-palette__dot--critical",
  high: "field-palette__dot--high",
  medium: "field-palette__dot--medium",
  low: "field-palette__dot--low",
};

const STATUS_CLASSES: Record<string, string> = {
  healthy: "field-palette__dot--healthy",
  stressed: "field-palette__dot--stressed",
  warning: "field-palette__dot--warning",
  pending: "field-palette__dot--pending",
};

/* ── Component ── */

export function FieldCommandPalette({
  open,
  onClose,
  onSelectField,
  onSelectZone,
  onSelectFinding,
  searchIndex,
}: FieldCommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  /* Focus input on open */
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  /* Global ⌘K / Escape */
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (!open) {
          // Parent should handle opening — but we don't close here
        } else {
          onClose();
        }
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  /* Build results */
  const results = useMemo<PaletteResult[]>(() => {
    const q = query.trim();
    if (q.length === 0) {
      // Show all fields as default, capped
      return searchIndex.fields.slice(0, 20);
    }

    const matched: PaletteResult[] = [];

    for (const f of searchIndex.fields) {
      if (fuzzyMatch(q, f.name, f.crop, f.area, f.legalLandDescription)) {
        matched.push(f);
      }
    }
    for (const z of searchIndex.zones) {
      if (fuzzyMatch(q, z.family, z.trackingKey, z.status, z.fieldName)) {
        matched.push(z);
      }
    }
    for (const f of searchIndex.findings) {
      if (fuzzyMatch(q, f.title, f.summary, f.severity, f.fieldName)) {
        matched.push(f);
      }
    }

    return matched.slice(0, 30);
  }, [query, searchIndex]);

  /* Keep activeIndex in bounds */
  useEffect(() => {
    if (activeIndex >= results.length) {
      setActiveIndex(Math.max(0, results.length - 1));
    }
  }, [results.length, activeIndex]);

  /* Scroll active item into view */
  useEffect(() => {
    const el = listRef.current?.querySelector("[data-active='true']");
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const selectResult = useCallback(
    (result: PaletteResult) => {
      switch (result.kind) {
        case "field":
          onSelectField?.(result.id);
          break;
        case "zone":
          onSelectZone?.(result.fieldId, result.zoneId);
          break;
        case "finding":
          onSelectFinding?.(result.fieldId, result.findingId);
          break;
      }
      onClose();
    },
    [onClose, onSelectField, onSelectZone, onSelectFinding],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && results[activeIndex]) {
        e.preventDefault();
        selectResult(results[activeIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [activeIndex, results, selectResult, onClose],
  );

  if (!open) return null;

  /* Group results by kind for section headers */
  const fieldResults = results.filter((r): r is PaletteFieldResult => r.kind === "field");
  const zoneResults = results.filter((r): r is PaletteZoneResult => r.kind === "zone");
  const findingResults = results.filter((r): r is PaletteFindingResult => r.kind === "finding");

  let globalIndex = -1;

  function renderFieldRow(r: PaletteFieldResult) {
    globalIndex++;
    const idx = globalIndex;
    return (
      <button
        key={`field:${r.id}`}
        type="button"
        className={`field-palette__row${idx === activeIndex ? " field-palette__row--active" : ""}`}
        data-active={idx === activeIndex}
        onClick={() => selectResult(r)}
        onMouseEnter={() => setActiveIndex(idx)}
      >
        <span className={`field-palette__dot ${STATUS_CLASSES[r.status ?? "pending"] ?? ""}`} />
        <span className="field-palette__row-name">{r.name}</span>
        {r.crop ? <span className="field-palette__row-meta">{r.crop}</span> : null}
        <span className="field-palette__row-meta field-palette__row-meta--mono">{r.area}</span>
      </button>
    );
  }

  function renderZoneRow(r: PaletteZoneResult) {
    globalIndex++;
    const idx = globalIndex;
    return (
      <button
        key={`zone:${r.fieldId}:${r.zoneId}`}
        type="button"
        className={`field-palette__row${idx === activeIndex ? " field-palette__row--active" : ""}`}
        data-active={idx === activeIndex}
        onClick={() => selectResult(r)}
        onMouseEnter={() => setActiveIndex(idx)}
      >
        <span className={`field-palette__dot ${SEVERITY_CLASSES[r.severity ?? ""] ?? "field-palette__dot--pending"}`} />
        <span className="field-palette__row-name">
          {r.family.replace(/_/g, " ")}
        </span>
        <span className="field-palette__row-meta">{r.status}</span>
        <span className="field-palette__row-meta field-palette__row-meta--dim">{r.fieldName}</span>
      </button>
    );
  }

  function renderFindingRow(r: PaletteFindingResult) {
    globalIndex++;
    const idx = globalIndex;
    return (
      <button
        key={`finding:${r.fieldId}:${r.findingId}`}
        type="button"
        className={`field-palette__row${idx === activeIndex ? " field-palette__row--active" : ""}`}
        data-active={idx === activeIndex}
        onClick={() => selectResult(r)}
        onMouseEnter={() => setActiveIndex(idx)}
      >
        <span className={`field-palette__dot ${SEVERITY_CLASSES[r.severity] ?? ""}`} />
        <span className="field-palette__row-name">{r.title}</span>
        <span className="field-palette__row-meta field-palette__row-meta--dim">{r.fieldName}</span>
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div className="field-palette__backdrop" onClick={onClose} />

      {/* Palette */}
      <div className="field-palette" role="dialog" aria-label="Field search">
        <div className="field-palette__input-row">
          <svg className="field-palette__input-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="field-palette__input"
            placeholder="Search fields, zones, findings…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            autoComplete="off"
          />
          <kbd className="field-palette__kbd">esc</kbd>
        </div>

        <div className="field-palette__results" ref={listRef}>
          {results.length === 0 ? (
            <div className="field-palette__empty">
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <>
              {fieldResults.length > 0 ? (
                <div className="field-palette__section">
                  <div className="field-palette__section-label">Fields</div>
                  {fieldResults.map(renderFieldRow)}
                </div>
              ) : null}

              {zoneResults.length > 0 ? (
                <div className="field-palette__section">
                  <div className="field-palette__section-label">Zones</div>
                  {zoneResults.map(renderZoneRow)}
                </div>
              ) : null}

              {findingResults.length > 0 ? (
                <div className="field-palette__section">
                  <div className="field-palette__section-label">Findings</div>
                  {findingResults.map(renderFindingRow)}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </>
  );
}
