"use client";

import { useRef, useEffect, useCallback, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import type { SidebarFieldItem } from "./Sidebar";
import { FieldStatusDot } from "../ui/FieldStatusDot";
import type { FieldHealthStatus } from "../ui/FieldStatusDot";

/* ── Crop icons (tiny inline SVG‑free labels) ── */
const CROP_ICONS: Record<string, string> = {
  canola: "🌻",
  wheat: "🌾",
  rye: "🌾",
  "faba bean": "🫘",
  barley: "🌾",
};

const STATUS_COLORS: Record<string, string> = {
  healthy: "var(--primary-green, #16a34a)",
  stressed: "var(--color-danger, #dc2626)",
  warning: "var(--color-warning, #d97706)",
  pending: "var(--text-tertiary, #94a3b8)",
};

const STATUS_LABEL: Record<string, string> = {
  healthy: "Healthy",
  stressed: "Stressed",
  warning: "Watch",
  pending: "Pending",
};

const SCROLL_AMOUNT = 200;
const HOLD_DELAY_MS = 180;
const QUARTER_ORDER = ["NE", "NW", "SE", "SW"] as const;

/* ── Grouping strategies ── */

type GroupStrategy = "none" | "crop" | "status" | "alerts";

const GROUP_LABELS: Record<GroupStrategy, string> = {
  none: "No grouping",
  crop: "By crop",
  status: "By status",
  alerts: "By alerts",
};

/* ── Sort strategies ── */

type SortStrategy = "name-asc" | "name-desc" | "status" | "area-desc" | "area-asc" | "alerts";

const SORT_LABELS: Record<SortStrategy, string> = {
  "name-asc": "Name A → Z",
  "name-desc": "Name Z → A",
  status: "Status severity",
  "area-desc": "Area (largest)",
  "area-asc": "Area (smallest)",
  alerts: "Alert count",
};

const STATUS_SORT_ORDER: Record<string, number> = {
  stressed: 0,
  warning: 1,
  pending: 2,
  healthy: 3,
};

function parseAreaHa(area: string): number {
  const match = area.match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

function sortFields(fields: SidebarFieldItem[], strategy: SortStrategy): SidebarFieldItem[] {
  const sorted = [...fields];
  switch (strategy) {
    case "name-asc":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case "name-desc":
      return sorted.sort((a, b) => b.name.localeCompare(a.name));
    case "status":
      return sorted.sort(
        (a, b) =>
          (STATUS_SORT_ORDER[a.status ?? "pending"] ?? 2) -
          (STATUS_SORT_ORDER[b.status ?? "pending"] ?? 2),
      );
    case "area-desc":
      return sorted.sort((a, b) => parseAreaHa(b.area) - parseAreaHa(a.area));
    case "area-asc":
      return sorted.sort((a, b) => parseAreaHa(a.area) - parseAreaHa(b.area));
    case "alerts":
      return sorted.sort((a, b) => (b.alertCount ?? 0) - (a.alertCount ?? 0));
    default:
      return sorted;
  }
}

type TabDef = {
  key: string;
  label: string;
  icon?: string;
  count: number;
  match: ((field: SidebarFieldItem) => boolean) | null;
};

function buildTabs(fields: SidebarFieldItem[], strategy: GroupStrategy): TabDef[] {
  const allTab: TabDef = { key: "all", label: "All", count: fields.length, match: null };

  if (strategy === "none") return [allTab];

  if (strategy === "crop") {
    const counts = new Map<string, number>();
    let unassigned = 0;
    for (const f of fields) {
      const crop = f.crop?.trim();
      if (crop) counts.set(crop, (counts.get(crop) ?? 0) + 1);
      else unassigned++;
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const tabs: TabDef[] = [allTab];
    for (const [crop, count] of sorted) {
      const icon = CROP_ICONS[crop.toLowerCase()] ?? "🌱";
      tabs.push({ key: `crop:${crop}`, label: crop, icon, count, match: (f) => f.crop?.trim() === crop });
    }
    if (unassigned > 0) {
      tabs.push({ key: "crop:none", label: "Unassigned", count: unassigned, match: (f) => !f.crop?.trim() });
    }
    return tabs;
  }

  if (strategy === "status") {
    const order: SidebarFieldItem["status"][] = ["stressed", "warning", "healthy", "pending"];
    const counts = new Map<string, number>();
    for (const f of fields) {
      const s = f.status ?? "pending";
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    const tabs: TabDef[] = [allTab];
    for (const status of order) {
      const count = counts.get(status ?? "pending");
      if (count && count > 0) {
        tabs.push({
          key: `status:${status}`,
          label: STATUS_LABEL[status ?? "pending"],
          count,
          match: (f) => (f.status ?? "pending") === status,
        });
      }
    }
    return tabs;
  }

  if (strategy === "alerts") {
    const withAlerts = fields.filter((f) => (f.alertCount ?? 0) > 0).length;
    const clear = fields.length - withAlerts;
    const tabs: TabDef[] = [allTab];
    if (withAlerts > 0) tabs.push({ key: "alerts:yes", label: "Has alerts", count: withAlerts, match: (f) => (f.alertCount ?? 0) > 0 });
    if (clear > 0) tabs.push({ key: "alerts:no", label: "Clear", count: clear, match: (f) => (f.alertCount ?? 0) === 0 });
    return tabs;
  }

  return [allTab];
}

/** Determine which strategies are meaningful for this data set. */
function availableStrategies(fields: SidebarFieldItem[]): GroupStrategy[] {
  const strategies: GroupStrategy[] = ["none"];

  // Crop grouping only if at least 2 distinct crops exist
  const crops = new Set(fields.map((f) => f.crop?.trim()).filter(Boolean));
  if (crops.size >= 2) strategies.push("crop");

  // Status grouping only if at least 2 distinct statuses
  const statuses = new Set(fields.map((f) => f.status ?? "pending"));
  if (statuses.size >= 2) strategies.push("status");

  // Alert grouping only if some fields have alerts
  if (fields.some((f) => (f.alertCount ?? 0) > 0)) strategies.push("alerts");

  return strategies;
}

type ParsedLld = {
  quarter: string;
  section: string;
  township: string;
  range: string;
  meridian: string;
};

function parseLegalLandDescription(
  legalLandDescription?: string | null,
): ParsedLld[] {
  if (!legalLandDescription) return [];

  return legalLandDescription
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const match = entry.match(
        /^(NE|NW|SE|SW)-(\d{2})-(\d{3})-(\d{2})-(W\d)$/i,
      );
      if (!match) return null;
      return {
        quarter: match[1].toUpperCase(),
        section: match[2],
        township: match[3],
        range: match[4],
        meridian: match[5].toUpperCase(),
      };
    })
    .filter((entry): entry is ParsedLld => entry !== null);
}

function formatLocationSummary(legalLandDescription?: string | null): string | null {
  const parsed = parseLegalLandDescription(legalLandDescription);

  if (parsed.length === 0) {
    return legalLandDescription?.trim() || null;
  }

  if (parsed.length === 1) {
    const [entry] = parsed;
    return `${entry.quarter}-${entry.section}-${entry.township}-${entry.range}-${entry.meridian}`;
  }

  const sectionKeys = new Set(
    parsed.map(
      (entry) =>
        `${entry.section}-${entry.township}-${entry.range}-${entry.meridian}`,
    ),
  );

  if (sectionKeys.size === 1) {
    const [sectionKey] = [...sectionKeys];
    return `${sectionKey} · ${parsed.length}Q`;
  }

  const tailKeys = new Set(
    parsed.map((entry) => `${entry.township}-${entry.range}-${entry.meridian}`),
  );

  if (tailKeys.size === 1) {
    const [tailKey] = [...tailKeys];
    if (parsed.length <= 3) {
      const compactEntries = parsed
        .slice()
        .sort(
          (left, right) =>
            QUARTER_ORDER.indexOf(left.quarter as (typeof QUARTER_ORDER)[number]) -
            QUARTER_ORDER.indexOf(right.quarter as (typeof QUARTER_ORDER)[number]),
        )
        .map((entry) => `${entry.quarter}-${entry.section}`);

      return `${compactEntries.join(" + ")} · ${tailKey}`;
    }

    return `${parsed.length} parcels · ${tailKey}`;
  }

  return `${parsed.length} parcels`;
}

export type FieldOnboardingStatus = {
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progressPct: number | null;
  phaseLabel: string | null;
};

export interface FieldStripProps {
  fields: SidebarFieldItem[];
  activeFieldId?: string;
  revealFieldId?: string;
  onFieldSelect?: (id: string) => void;
  onFieldPrefetch?: (id: string) => void;
  onAddField?: () => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  onSearchOpen?: () => void;
  onboardingProgress?: ReadonlyMap<string, FieldOnboardingStatus>;
  onFieldRename?: (fieldId: string, newName: string) => void;
  onFieldDelete?: (fieldId: string) => void;
  onFieldEdit?: (fieldId: string) => void;
  /** Base URL for report export, e.g. "/api/fields". fieldId is appended. */
  exportBaseUrl?: string;
  workspaceId?: string | null;
}

export function FieldStrip({
  fields,
  activeFieldId,
  revealFieldId,
  onFieldSelect,
  onFieldPrefetch,
  onAddField,
  onReorder,
  onSearchOpen,
  onboardingProgress,
  onFieldRename,
  onFieldDelete,
  onFieldEdit,
  exportBaseUrl = "/api/fields",
  workspaceId,
}: FieldStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  /* ── Track new arrivals for entrance animation ── */
  const prevFieldIdsRef = useRef<Set<string>>(new Set());
  const [newFieldIds, setNewFieldIds] = useState<Set<string>>(new Set());
  const [completedFieldIds, setCompletedFieldIds] = useState<Set<string>>(new Set());
  const prevOnboardingRef = useRef<ReadonlyMap<string, FieldOnboardingStatus>>(new Map());

  useEffect(() => {
    const currentIds = new Set(fields.map((f) => f.id));
    const prevIds = prevFieldIdsRef.current;
    const arrivals = new Set<string>();
    for (const id of currentIds) {
      if (!prevIds.has(id)) arrivals.add(id);
    }
    if (arrivals.size > 0) {
      setNewFieldIds(arrivals);
      // Clear after animation duration (stagger + animation = ~600ms max)
      const timer = setTimeout(() => setNewFieldIds(new Set()), 800);
      return () => clearTimeout(timer);
    }
    prevFieldIdsRef.current = currentIds;
  }, [fields]);

  // Detect completion: was onboarding, now isn't
  useEffect(() => {
    if (!onboardingProgress) return;
    const prev = prevOnboardingRef.current;
    const completed = new Set<string>();
    for (const [id, status] of prev) {
      const current = onboardingProgress.get(id);
      if ((status.status === 'queued' || status.status === 'running') && (!current || current.status === 'completed')) {
        completed.add(id);
      }
    }
    if (completed.size > 0) {
      setCompletedFieldIds(completed);
      const timer = setTimeout(() => setCompletedFieldIds(new Set()), 1200);
      prevOnboardingRef.current = onboardingProgress;
      return () => clearTimeout(timer);
    }
    prevOnboardingRef.current = onboardingProgress;
  }, [onboardingProgress]);

  /* ── Kebab menu + inline rename state ── */
  const [kebabFieldId, setKebabFieldId] = useState<string | null>(null);
  const [renamingFieldId, setRenamingFieldId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteConfirmFieldId, setDeleteConfirmFieldId] = useState<string | null>(null);
  const kebabMenuRef = useRef<HTMLDivElement>(null);
  const kebabTriggerRef = useRef<HTMLSpanElement>(null);
  const [kebabPos, setKebabPos] = useState<{ top: number; right: number } | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  /* ── Grouping + tabs ── */
  const [groupStrategy, setGroupStrategy] = useState<GroupStrategy>("none");
  const [activeTabKey, setActiveTabKey] = useState("all");
  const [groupMenuOpen, setGroupMenuOpen] = useState(false);
  const groupContainerRef = useRef<HTMLDivElement>(null);

  /* ── Sorting ── */
  const [sortStrategy, setSortStrategy] = useState<SortStrategy>("name-asc");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortContainerRef = useRef<HTMLDivElement>(null);
  const lastRevealFieldIdRef = useRef<string | null>(null);
  const lastScrolledRevealFieldIdRef = useRef<string | null>(null);

  const strategies = useMemo(() => availableStrategies(fields), [fields]);
  const tabs = useMemo(() => buildTabs(fields, groupStrategy), [fields, groupStrategy]);

  /* Auto-pick a useful default when strategies change (e.g. on first load) */
  useEffect(() => {
    if (groupStrategy !== "none" && !strategies.includes(groupStrategy)) {
      setGroupStrategy("none");
      setActiveTabKey("all");
    }
  }, [strategies, groupStrategy]);

  /* Reset tab if it disappeared after data update */
  useEffect(() => {
    if (!tabs.find((t) => t.key === activeTabKey)) {
      setActiveTabKey("all");
    }
  }, [tabs, activeTabKey]);

  const activeTab = tabs.find((t) => t.key === activeTabKey) ?? tabs[0];

  useEffect(() => {
    if (!revealFieldId || revealFieldId === lastRevealFieldIdRef.current) {
      return;
    }

    const revealedField = fields.find((field) => field.id === revealFieldId);
    if (!revealedField) {
      return;
    }

    if (activeTabKey !== "all" && activeTab.match && !activeTab.match(revealedField)) {
      setActiveTabKey("all");
    }

    lastRevealFieldIdRef.current = revealFieldId;
  }, [activeTab, activeTabKey, fields, revealFieldId]);

  /* Close group menu on outside click */
  useEffect(() => {
    if (!groupMenuOpen) return;
    function handleClick(e: MouseEvent) {
      if (groupContainerRef.current?.contains(e.target as Node)) return;
      setGroupMenuOpen(false);
    }
    window.addEventListener("pointerdown", handleClick);
    return () => window.removeEventListener("pointerdown", handleClick);
  }, [groupMenuOpen]);

  /* Close sort menu on outside click */
  useEffect(() => {
    if (!sortMenuOpen) return;
    function handleClick(e: MouseEvent) {
      if (sortContainerRef.current?.contains(e.target as Node)) return;
      setSortMenuOpen(false);
    }
    window.addEventListener("pointerdown", handleClick);
    return () => window.removeEventListener("pointerdown", handleClick);
  }, [sortMenuOpen]);

  /* Close kebab menu on outside click */
  useEffect(() => {
    if (!kebabFieldId) return;
    function handleClick(e: MouseEvent) {
      if (kebabMenuRef.current?.contains(e.target as Node)) return;
      setKebabFieldId(null);
      setDeleteConfirmFieldId(null);
    }
    window.addEventListener("pointerdown", handleClick);
    return () => window.removeEventListener("pointerdown", handleClick);
  }, [kebabFieldId]);

  /* Focus rename input when entering rename mode */
  useEffect(() => {
    if (renamingFieldId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingFieldId]);

  const filteredFields = useMemo(() => {
    const filtered = activeTab.match ? fields.filter(activeTab.match) : fields;
    return sortFields(filtered, sortStrategy);
  }, [fields, activeTab, sortStrategy]);

  /* ── Drag state ── */
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingCardRef = useRef(false);
  const suppressClickRef = useRef(false);

  /* ── Grab-to-scroll state ── */
  const isGrabScrollingRef = useRef(false);
  const grabStartXRef = useRef(0);
  const grabScrollLeftRef = useRef(0);

  /* Check scroll position to show/hide arrows */
  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  /* Scroll active card into view on mount / change */
  useEffect(() => {
    if (!activeFieldId || !scrollRef.current) return;
    const active = scrollRef.current.querySelector(
      `[data-field-id="${activeFieldId}"]`,
    ) as HTMLElement | null;
    if (active) {
      active.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [activeFieldId]);

  useEffect(() => {
    if (!revealFieldId || !scrollRef.current) return;
    if (revealFieldId === lastScrolledRevealFieldIdRef.current) {
      return;
    }
    const revealed = scrollRef.current.querySelector(
      `[data-field-id="${revealFieldId}"]`,
    ) as HTMLElement | null;
    if (revealed) {
      revealed.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      lastScrolledRevealFieldIdRef.current = revealFieldId;
    }
  }, [filteredFields, revealFieldId]);

  /* Init scroll state + listen for scroll events */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      ro.disconnect();
    };
  }, [updateScrollState]);

  /* Horizontal scroll via mouse wheel */
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!scrollRef.current) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      scrollRef.current.scrollLeft += e.deltaY;
    }
  }, []);

  const scrollBy = useCallback((dir: -1 | 1) => {
    scrollRef.current?.scrollBy({ left: dir * SCROLL_AMOUNT, behavior: "smooth" });
  }, []);

  /* ── Grab-to-scroll: pointerdown on the scroll rail ── */
  const handleRailPointerDown = useCallback((e: React.PointerEvent) => {
    /* Only start grab-scroll if the target is the rail itself or group gap, not a card */
    const target = e.target as HTMLElement;
    if (target.closest(".field-strip__card")) return;
    if (!scrollRef.current) return;

    isGrabScrollingRef.current = true;
    grabStartXRef.current = e.clientX;
    grabScrollLeftRef.current = scrollRef.current.scrollLeft;
    scrollRef.current.style.scrollBehavior = "auto";
    scrollRef.current.setPointerCapture(e.pointerId);
  }, []);

  const handleRailPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isGrabScrollingRef.current || !scrollRef.current) return;
    const dx = e.clientX - grabStartXRef.current;
    scrollRef.current.scrollLeft = grabScrollLeftRef.current - dx;
  }, []);

  const handleRailPointerUp = useCallback((e: React.PointerEvent) => {
    if (!isGrabScrollingRef.current) return;
    isGrabScrollingRef.current = false;
    if (scrollRef.current) {
      scrollRef.current.style.scrollBehavior = "smooth";
      scrollRef.current.releasePointerCapture(e.pointerId);
    }
  }, []);

  /* ── Card drag-to-reorder ── */
  const handleCardPointerDown = useCallback(
    (e: React.PointerEvent, index: number) => {
      /* Start a hold timer — if they move quickly, it becomes a grab-scroll instead */
      const startX = e.clientX;
      const pointerId = e.pointerId;

      holdTimerRef.current = setTimeout(() => {
        isDraggingCardRef.current = true;
        suppressClickRef.current = true;
        setDragIndex(index);
        setHoverIndex(index);
        /* Capture pointer for the card so we get move/up even outside */
        (e.target as HTMLElement).closest(".field-strip__card")?.setPointerCapture(pointerId);
      }, HOLD_DELAY_MS);

      /* If they move > 6px before the timer fires, cancel and fall through to grab-scroll */
      const onEarlyMove = (me: PointerEvent) => {
        if (!holdTimerRef.current) return;
        const dx = Math.abs(me.clientX - startX);
        if (dx > 6) {
          clearTimeout(holdTimerRef.current!);
          holdTimerRef.current = null;
          window.removeEventListener("pointermove", onEarlyMove);
          /* Trigger grab-scroll manually */
          suppressClickRef.current = true;
          if (scrollRef.current) {
            isGrabScrollingRef.current = true;
            grabStartXRef.current = startX;
            grabScrollLeftRef.current = scrollRef.current.scrollLeft;
            scrollRef.current.style.scrollBehavior = "auto";
          }
        }
      };
      window.addEventListener("pointermove", onEarlyMove);

      /* Clean up early-move listener once the hold fires or pointer goes up */
      const cleanup = () => {
        window.removeEventListener("pointermove", onEarlyMove);
        window.removeEventListener("pointerup", cleanup);
      };
      window.addEventListener("pointerup", cleanup, { once: true });
    },
    [],
  );

  const handleCardPointerMove = useCallback(
    (e: React.PointerEvent) => {
      /* If in grab-scroll mode (early move cancelled hold), scroll the rail */
      if (isGrabScrollingRef.current && scrollRef.current) {
        const dx = e.clientX - grabStartXRef.current;
        scrollRef.current.scrollLeft = grabScrollLeftRef.current - dx;
        return;
      }

      if (!isDraggingCardRef.current || dragIndex === null) return;

      /* Determine which card we're hovering over */
      const groupEl = scrollRef.current?.querySelector(".field-strip__group");
      if (!groupEl) return;
      const cards = Array.from(groupEl.children) as HTMLElement[];
      for (let i = 0; i < cards.length; i++) {
        const rect = cards[i].getBoundingClientRect();
        const midX = rect.left + rect.width / 2;
        if (e.clientX < midX) {
          setHoverIndex(i);
          return;
        }
      }
      setHoverIndex(cards.length - 1);
    },
    [dragIndex],
  );

  const handleCardPointerUp = useCallback(
    (e: React.PointerEvent) => {
      /* If the hold timer is still pending, this was a quick tap — let click fire normally */
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
        /* Don't suppress — the onClick will handle the field select */
        return;
      }

      /* If we were grab-scrolling, stop */
      if (isGrabScrollingRef.current) {
        isGrabScrollingRef.current = false;
        if (scrollRef.current) scrollRef.current.style.scrollBehavior = "smooth";
        return;
      }

      if (!isDraggingCardRef.current || dragIndex === null) return;

      const target = hoverIndex ?? dragIndex;
      if (target !== dragIndex && onReorder) {
        onReorder(dragIndex, target);
      }

      isDraggingCardRef.current = false;
      setDragIndex(null);
      setHoverIndex(null);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* pointer capture may already be released */
      }
    },
    [dragIndex, hoverIndex, onReorder],
  );

  /* Build the ordered field list (with reorder preview) */
  const displayFields =
    dragIndex !== null && hoverIndex !== null && dragIndex !== hoverIndex
      ? (() => {
          const arr = [...filteredFields];
          const [moved] = arr.splice(dragIndex, 1);
          arr.splice(hoverIndex, 0, moved);
          return arr;
        })()
      : filteredFields;

  return (
    <div className="field-strip">
      {/* ── Header row: tabs + controls ── */}
      <div className="field-strip__header">
        <div className="field-strip__tabs" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={tab.key === activeTabKey}
              className={`field-strip__tab${tab.key === activeTabKey ? " field-strip__tab--active" : ""}`}
              onClick={() => setActiveTabKey(tab.key)}
            >
              {tab.icon ? <span className="field-strip__tab-icon">{tab.icon}</span> : null}
              <span className="field-strip__tab-label">{tab.label}</span>
              <span className="field-strip__tab-count">{tab.count}</span>
            </button>
          ))}
        </div>

        <div className="field-strip__controls">
          {onSearchOpen ? (
            <button
              type="button"
              className="field-strip__search-btn"
              onClick={onSearchOpen}
              aria-label="Search fields"
              title="Search fields, zones, findings…"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>
          ) : null}

          {/* Group-by dropdown */}
          {strategies.length > 1 ? (
            <div ref={groupContainerRef} className="field-strip__group-by">
              <button
                type="button"
                className={`field-strip__group-btn${groupStrategy !== "none" ? " field-strip__group-btn--active" : ""}`}
                onClick={() => setGroupMenuOpen((v) => !v)}
                aria-label="Group fields"
                title="Group by…"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
                <svg className="field-strip__group-chevron" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="18 15 12 9 6 15" />
                </svg>
              </button>
              {groupMenuOpen ? (
                <div className="field-strip__group-menu">
                  {strategies.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`field-strip__group-option${s === groupStrategy ? " field-strip__group-option--active" : ""}`}
                      onClick={() => {
                        setGroupStrategy(s);
                        setActiveTabKey("all");
                        setGroupMenuOpen(false);
                      }}
                    >
                      {s === groupStrategy ? (
                        <svg className="field-strip__group-check" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <span className="field-strip__group-check" />
                      )}
                      <span>{GROUP_LABELS[s]}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Sort-by dropdown */}
          <div ref={sortContainerRef} className="field-strip__sort-by">
            <button
              type="button"
              className={`field-strip__sort-btn${sortStrategy !== "name-asc" ? " field-strip__sort-btn--active" : ""}`}
              onClick={() => setSortMenuOpen((v) => !v)}
              aria-label="Sort fields"
              title="Sort by…"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="12" x2="16" y2="12" />
                <line x1="4" y1="18" x2="12" y2="18" />
              </svg>
              <svg className="field-strip__sort-chevron" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="18 15 12 9 6 15" />
              </svg>
            </button>
            {sortMenuOpen ? (
              <div className="field-strip__sort-menu">
                {(Object.keys(SORT_LABELS) as SortStrategy[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`field-strip__group-option${s === sortStrategy ? " field-strip__group-option--active" : ""}`}
                    onClick={() => {
                      setSortStrategy(s);
                      setSortMenuOpen(false);
                    }}
                  >
                    {s === sortStrategy ? (
                      <svg className="field-strip__group-check" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <span className="field-strip__group-check" />
                    )}
                    <span>{SORT_LABELS[s]}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="field-strip__arrows">
            <button
              type="button"
              className={`field-strip__arrow${canScrollLeft ? "" : " field-strip__arrow--hidden"}`}
              onClick={() => scrollBy(-1)}
              aria-label="Scroll left"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              type="button"
              className={`field-strip__arrow${canScrollRight ? "" : " field-strip__arrow--hidden"}`}
              onClick={() => scrollBy(1)}
              aria-label="Scroll right"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── Card rail ── */}
      <div className="field-strip__rail">
        {onAddField ? (
          <button
            type="button"
            className="field-strip__add-btn"
            onClick={onAddField}
            aria-label="Add field"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add
          </button>
        ) : null}

        {fields.length === 0 ? (
          <div className="field-strip__empty">
            <span className="field-strip__empty-text">
              No fields yet — add your first field to get started
            </span>
          </div>
        ) : filteredFields.length === 0 ? (
          <div className="field-strip__empty">
            <span className="field-strip__empty-text">
              No fields match this filter
            </span>
          </div>
        ) : (
          <div
            ref={scrollRef}
            className={`field-strip__scroll${isGrabScrollingRef.current ? " field-strip__scroll--grabbing" : ""}`}
            onWheel={handleWheel}
            onPointerDown={handleRailPointerDown}
            onPointerMove={handleRailPointerMove}
            onPointerUp={handleRailPointerUp}
          >
            <div className={`field-strip__group${dragIndex !== null ? " field-strip__group--reordering" : ""}`}>
              {displayFields.map((field, i) => {
              const isActive = field.id === activeFieldId;
              const statusColor = STATUS_COLORS[field.status ?? "pending"];
              const cropIcon = CROP_ICONS[(field.crop ?? "").toLowerCase()] ?? "🌱";
              const locationSummary = formatLocationSummary(
                field.legalLandDescription,
              );
              const isDragged =
                dragIndex !== null &&
                hoverIndex !== null &&
                field.id === filteredFields[dragIndex]?.id;
              const fieldProgress = onboardingProgress?.get(field.id) ?? null;
              const isOnboarding = fieldProgress != null && (fieldProgress.status === 'queued' || fieldProgress.status === 'running');
              const progressPct = isOnboarding ? (fieldProgress.progressPct ?? 0) : 0;
              const isRenaming = renamingFieldId === field.id;
              const isKebabOpen = kebabFieldId === field.id;

              /* Phase label replaces location during onboarding */
              const onboardingLabel = isOnboarding
                ? (fieldProgress.phaseLabel || (fieldProgress.status === 'running' ? 'syncing' : 'queued'))
                : null;
              const isNewArrival = newFieldIds.has(field.id);
              const isJustCompleted = completedFieldIds.has(field.id);
              const entranceDelay = isNewArrival ? `${Math.min(i * 60, 360)}ms` : undefined;

            return (
              <div key={field.id} className="field-strip__card-wrap" style={{ position: "relative", flexShrink: 0 }}>
              <button
                data-field-id={field.id}
                className={`field-strip__card${isActive ? " field-strip__card--active" : ""}${isDragged ? " field-strip__card--dragging" : ""}${isOnboarding ? " field-strip__card--onboarding" : ""}${isNewArrival ? " field-strip__card--entering" : ""}${isJustCompleted ? " field-strip__card--completed" : ""}`}
                onClick={() => {
                  if (suppressClickRef.current) {
                    suppressClickRef.current = false;
                    return;
                  }
                  if (isRenaming) return;
                  onFieldSelect?.(field.id);
                }}
                onMouseEnter={() => onFieldPrefetch?.(field.id)}
                onFocus={() => onFieldPrefetch?.(field.id)}
                onPointerDown={(e) => handleCardPointerDown(e, i)}
                onPointerMove={handleCardPointerMove}
                onPointerUp={handleCardPointerUp}
                type="button"
                title={isOnboarding
                  ? `${field.name} · ${onboardingLabel}`
                  : (field.legalLandDescription ? `${field.name} · ${field.legalLandDescription}` : field.name)}
                style={{
                  ...(isOnboarding ? {
                    borderBottom: '2px solid transparent',
                    borderImage: `linear-gradient(to right, rgba(22,163,74,0.35) ${progressPct}%, transparent ${progressPct}%) 1`,
                  } : {}),
                  ...(entranceDelay ? { animationDelay: entranceDelay } : {}),
                }}
              >
                <FieldStatusDot
                  status={(field.status ?? "pending") as FieldHealthStatus}
                  progressPct={isOnboarding ? progressPct : undefined}
                  size={8}
                />
                {isRenaming ? (
                  <input
                    ref={renameInputRef}
                    className="field-strip__rename-input"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const trimmed = renameValue.trim();
                        if (trimmed && trimmed !== field.name) {
                          onFieldRename?.(field.id, trimmed);
                        }
                        setRenamingFieldId(null);
                      } else if (e.key === "Escape") {
                        setRenamingFieldId(null);
                      }
                    }}
                    onBlur={() => {
                      const trimmed = renameValue.trim();
                      if (trimmed && trimmed !== field.name) {
                        onFieldRename?.(field.id, trimmed);
                      }
                      setRenamingFieldId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="field-strip__card-name">{field.name}</span>
                )}
                {!isRenaming && isOnboarding ? (
                  <span className="field-strip__card-location field-card__phase-label">
                    {onboardingLabel}
                  </span>
                ) : !isRenaming && locationSummary ? (
                  <span className="field-strip__card-location">
                    {locationSummary}
                  </span>
                ) : null}
                {isActive && !isOnboarding && !isRenaming && (
                  <span className="field-strip__card-meta">
                    {field.crop ? (
                      <span className="field-strip__card-crop">
                        {cropIcon} {field.crop}
                      </span>
                    ) : null}
                    <span className="field-strip__card-area">{field.area}</span>
                    {field.alertCount ? (
                      <span className="field-strip__card-alerts">
                        {field.alertCount}
                      </span>
                    ) : null}
                  </span>
                )}
                {/* Kebab trigger — only on active card, not during rename/onboarding */}
                {isActive && !isOnboarding && !isRenaming && (
                  <span
                    ref={isKebabOpen || !kebabFieldId ? kebabTriggerRef : undefined}
                    className="field-strip__kebab"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isKebabOpen) {
                        setKebabFieldId(null);
                        setKebabPos(null);
                      } else {
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setKebabPos({ top: rect.top, right: window.innerWidth - rect.right });
                        setKebabFieldId(field.id);
                      }
                      setDeleteConfirmFieldId(null);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    role="button"
                    tabIndex={0}
                    aria-label="Field actions"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="5" r="2" />
                      <circle cx="12" cy="12" r="2" />
                      <circle cx="12" cy="19" r="2" />
                    </svg>
                  </span>
                )}
              </button>

              {/* Kebab menu rendered via portal — see below */}
              </div>
            );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Kebab dropdown menu — portaled to body to escape overflow:hidden ── */}
      {kebabFieldId && kebabPos && (() => {
        const menuField = fields.find((f) => f.id === kebabFieldId);
        if (!menuField) return null;
        return createPortal(
          <div
            ref={kebabMenuRef}
            className="field-strip__kebab-menu"
            style={{ position: "fixed", top: kebabPos.top - 6, right: kebabPos.right, bottom: "auto", transform: "translateY(-100%)" }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {deleteConfirmFieldId === menuField.id ? (
              <div className="field-strip__kebab-confirm">
                <span className="field-strip__kebab-confirm-text">Delete this field?</span>
                <div className="field-strip__kebab-confirm-actions">
                  <button
                    type="button"
                    className="field-strip__kebab-confirm-btn field-strip__kebab-confirm-btn--danger"
                    onClick={() => { onFieldDelete?.(menuField.id); setKebabFieldId(null); setKebabPos(null); setDeleteConfirmFieldId(null); }}
                  >Delete</button>
                  <button
                    type="button"
                    className="field-strip__kebab-confirm-btn"
                    onClick={() => setDeleteConfirmFieldId(null)}
                  >Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <button type="button" className="field-strip__kebab-item" onClick={() => { setRenameValue(menuField.name); setRenamingFieldId(menuField.id); setKebabFieldId(null); setKebabPos(null); }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
                  Rename
                </button>
                {onFieldEdit && (
                  <button type="button" className="field-strip__kebab-item" onClick={() => { onFieldEdit(menuField.id); setKebabFieldId(null); setKebabPos(null); }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                    Edit field
                  </button>
                )}
                <a
                  className="field-strip__kebab-item"
                  href={`${exportBaseUrl}/${menuField.id}/report-export${workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : ""}`}
                  download
                  onClick={() => { setKebabFieldId(null); setKebabPos(null); }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                  Export PDF
                </a>
                <div className="field-strip__kebab-separator" />
                <button type="button" className="field-strip__kebab-item field-strip__kebab-item--danger" onClick={() => setDeleteConfirmFieldId(menuField.id)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                  Delete
                </button>
              </>
            )}
          </div>,
          document.body,
        );
      })()}
    </div>
  );
}
