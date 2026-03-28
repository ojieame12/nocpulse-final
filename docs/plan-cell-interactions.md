# Cell Interaction Implementation Plan

## Current State

The live field route renders like this:

```
FieldOverviewScreen (server component — fetches data)
  └─ buildFieldOverviewViewModel → mapPreview model
       └─ FieldPageShell (client boundary — manages panel state)
            ├─ WorkspaceShell
            │   └─ map-area__canvas
            │       └─ LazyFieldBoundaryMap model={mapPreview}  ← no callbacks
            └─ panel (DetailPanel | AlertsPanel)
```

**What's wired:** pickable cells, autoHighlight, hover dimming, tooltip, click selection with lift + ring.
**What's disconnected:** none of it talks to the panel, summary, or any app state.

---

## Phase 1 — Enrich the Cell Render Model

**Goal:** Make each cell carry enough data for an inspector, not just a color.

### Expand `FieldAgronomicCellRenderModel`

```typescript
// domain/render/FieldAgronomicSurfaceRenderModel.ts
export type FieldAgronomicCellRenderModel = {
  id: string;
  centroid: MapGeoPoint;
  polygon: MapGeoPoint[];
  metricValuePct: number;
  displayHeightM: number;
  fillColor: MapRgbaColor;
  lineColor: MapRgbaColor;

  // ── New: analytics payload ──
  confidence: number;              // 0–1 per-cell confidence
  sourceTier: string;              // "fresh-sar" | "model-only" | etc
  varianceBucket: "low" | "medium" | "high";
  deltaFromFieldAvgPct: number;    // deviation from field mean
  zoneId: string | null;           // tracked zone association
  severityLabel: string | null;    // "healthy" | "stressed" | "critical"
};
```

**Files changed:**
- `packages/map/src/domain/render/FieldAgronomicSurfaceRenderModel.ts`
- `packages/map/src/application/buildFieldAgronomicSurfaceRenderModel.ts` — populate new fields from synthetic or real data
- `packages/map/src/application/buildFieldMoistureSurfaceRenderModel.ts` — map persisted cell data to new fields

---

## Phase 2 — Hover State Model + Rich Tooltip

**Goal:** Tooltip shows multi-line detail, not just one number.

### Expand `CellHoverEvent`

```typescript
// domain/interaction/CellInteractionEvent.ts
export type CellHoverEvent = {
  cellId: string;
  metricKey: FieldAgronomicSurfaceMetricKey;
  metricValuePct: number;
  displayHeightM: number;
  screenX: number;
  screenY: number;

  // ── New ──
  confidence: number;
  sourceTier: string;
  deltaFromFieldAvgPct: number;
  varianceBucket: "low" | "medium" | "high";
  severityLabel: string | null;
  zoneId: string | null;
};
```

### Rich Tooltip Layout

```
┌──────────────────────────────────┐
│  NDVI · Zone NW-3                │
│  0.62  ▲ +4.2% vs field avg     │
│  Confidence: High · Fresh SAR    │
│  Variance: Low                   │
└──────────────────────────────────┘
```

**Files changed:**
- `packages/map/src/domain/interaction/CellInteractionEvent.ts`
- `packages/map/src/infrastructure/runtime/createFieldBoundaryPreviewRuntime.ts` — emit richer hover data
- `apps/web/src/features/fields/CellTooltip.tsx` — multi-line layout

---

## Phase 3 — Selection → Panel Sync

**Goal:** Clicking a cell opens a cell inspector in the right panel.

### Architecture

The challenge: `FieldOverviewScreen` is a server component, so it can't hold client state. `FieldPageShell` IS the client boundary and already manages `panelView`. The map is currently passed as a `ReactNode`.

**Solution:** Move the map model into `FieldPageShell` props (not as a prebuilt ReactNode), and render the map inside the shell so it can receive callbacks.

```
FieldOverviewScreen (server)
  └─ FieldPageShell (client)
       ├─ mapModel={viewModel.mapPreview}     ← model, not ReactNode
       ├─ selectedCellId state
       ├─ LazyFieldBoundaryMap
       │   ├─ model={mapModel}
       │   └─ onCellClick={handleCellClick}   ← wired
       └─ panel
            ├─ DetailPanel (when no cell selected)
            ├─ AlertsPanel (when nav=Alerts)
            └─ CellInspectorPanel (when cell selected) ← NEW
```

### New Panel View

Add `"cell-inspector"` to `PanelView`:

```typescript
type PanelView = "detail" | "alerts" | "cell-inspector";
```

### `CellInspectorPanel` Component

Shows for the selected cell:
- Cell ID / zone label
- Metric value + delta from field average
- Confidence + source tier
- Severity classification
- Mini color ramp with marker showing cell position
- "Dismiss" button → clears selection, returns to detail panel

**Files changed:**
- `apps/web/src/features/fields/FieldPageShell.tsx` — accept mapModel instead of map ReactNode, manage selectedCell state, render CellInspectorPanel
- `apps/web/src/features/fields/FieldOverviewScreen.tsx` — pass mapModel prop
- `apps/web/src/components/panels/CellInspectorPanel.tsx` — NEW
- `apps/web/src/features/fields/LazyFieldBoundaryMap.tsx` — already supports onCellClick

### Data Flow

```
User clicks cell in deck.gl
  → runtime.handleCellClick fires
  → onCellClick callback to React
  → FieldPageShell.handleCellClick
  → setState({ panelView: "cell-inspector", selectedCell: event })
  → CellInspectorPanel renders with cell data
  → Panel "Dismiss" button → setState({ panelView: "detail", selectedCell: null })
```

---

## Phase 4 — Zone Highlight Integration

**Goal:** Hovering or selecting a cell highlights its tracked zone.

### Prerequisites
- Zones loaded from Supabase (zone_id per cell)
- Zone boundary polygons available

### Implementation

1. **Zone overlay layer** — new GeoJsonLayer in the runtime that renders zone boundaries as dashed outlines (invisible by default)
2. **Zone highlight on hover** — when hovering a cell with a zoneId, the zone boundary layer for that zone gets `getLineColor: [255,255,255,180]` (bright outline)
3. **Zone highlight on selection** — same, but persistent until deselected

**Runtime changes:**
- Add `highlightedZoneId` to `InteractionState`
- Add zone boundary data to the render model (new `zones` field)
- New `PathLayer` for zone outlines, filtered by `highlightedZoneId`

**Files changed:**
- `packages/map/src/domain/render/FieldBoundaryPreviewRenderModel.ts` — add zones array
- `packages/map/src/infrastructure/runtime/createFieldBoundaryPreviewRuntime.ts` — zone highlight layer
- `apps/web/src/features/fields/buildFieldOverviewViewModel.ts` — load zones from catalog

---

## Phase 5 — Tracked-Zone Aware Tooltips

**Goal:** Tooltip content adapts based on zone context.

### Zone-Enriched Tooltip

When the hovered cell belongs to a tracked zone:
```
┌──────────────────────────────────────┐
│  Zone NW-3 · Moisture Stress Watch   │
│  Root Moisture: 22.4%  ▼ -8.1%      │
│  3 cells in zone · 2 below threshold │
│  Since: Mar 24                       │
└──────────────────────────────────────┘
```

When no zone:
```
┌────────────────────────────────┐
│  NDVI  0.62  ▲ +4.2%          │
│  High confidence · Fresh SAR   │
└────────────────────────────────┘
```

### Implementation

- `CellTooltip` checks if `hover.zoneId` is set
- If yes, look up zone context from a zone map passed as prop
- Render zone-specific content (zone name, finding summary, cell count in zone)

**Files changed:**
- `apps/web/src/features/fields/CellTooltip.tsx` — zone-aware layout
- `apps/web/src/features/fields/FieldPageShell.tsx` — pass zone context to tooltip

---

## Execution Order

| # | Phase | Effort | Dependencies |
|---|-------|--------|--------------|
| 1 | Enrich cell render model | Small | None |
| 2 | Rich tooltip | Small | Phase 1 |
| 3 | Selection → panel sync | Medium | Phase 1 |
| 4 | Zone highlight | Medium | Phase 1 + zones in Supabase |
| 5 | Zone-aware tooltips | Small | Phase 4 |

**Phases 1–3 can ship independently.** They only require the data already flowing through the moisture pipeline.

**Phases 4–5 require zone data in Supabase** (the `tracked_zones` table and zone-to-cell associations). If that's not materialized yet, phases 4–5 wait.

---

## Key Architectural Decision

**Move map from ReactNode to model prop in FieldPageShell.**

Currently:
```tsx
// FieldOverviewScreen (server)
map={<LazyFieldBoundaryMap model={viewModel.mapPreview} />}
```

Proposed:
```tsx
// FieldOverviewScreen (server)
mapModel={viewModel.mapPreview}
```

This is the unlock. It lets `FieldPageShell` (the client boundary) own the map render and wire `onCellClick` / `onCellHover` into its own state. Without this change, the server component owns the map element and client interaction is impossible.
