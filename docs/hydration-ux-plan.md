# Field Hydration UX — Polish Plan

## Design Principle

The async worker gap is not a bug to hide — it's a story to tell. When a farmer adds 32 fields, they should feel the system working for them. The experience should feel like watching seeds germinate: purposeful, progressive, alive.

Matches the design system ethos: "editorial agricultural journal" — calm, grounded, data-dense but readable. No spinners, no loading bars. Organic transitions.

---

## The 7 Moments

### Moment 1 — "I just committed my fields"

**Current:** AddFieldPanel closes. Fields appear in sidebar. No fanfare.

**Target:** After CSV commit or single LLD create, show a **Commit Confirmation Card** that slides up inside the AddFieldPanel before it closes:

```
┌─────────────────────────────────────────┐
│  ✓  32 fields queued                    │
│                                         │
│  Soil · Weather · Imagery · Moisture    │
│  ○       ○         ○         ○          │
│                                         │
│  Each field takes about 60 seconds.     │
│  You can browse while data arrives.     │
│                                         │
│        [ View Fields → ]                │
└─────────────────────────────────────────┘
```

- 4 stage dots (unfilled circles) preview the pipeline
- Single line setting expectations: "about 60 seconds"
- CTA navigates to the first field
- Card auto-dismisses after 5s if user doesn't interact
- Uses `--font-body` (Sintony), `--text-sm`, `--text-muted` for the subtitle

**Component:** `CommitConfirmationCard` — pure presentational, no new data dependencies

---

### Moment 2 — "My fields are in the sidebar"

**Current:** Already good. FieldStrip cards show:
- Reduced opacity name (45%)
- Phase label replacing location ("syncing imagery")
- Green gradient progress border at bottom
- FieldStatusDot conic-gradient ring

**Polish needed:**

1. **Stagger card entrance animation** — when 32 fields appear at once, they should cascade in with 30ms stagger, not all pop simultaneously. Add `animation-delay: calc(var(--card-index) * 30ms)` to `.field-strip__card--entering`.

2. **Phase label transitions** — currently just text swaps. Add a 150ms crossfade when the label changes from "queued" → "fetching soil" → "collecting weather" → "acquiring imagery" → "computing moisture". Use `opacity` transition, not layout shift.

3. **Batch progress summary** — when multiple fields are onboarding, show a small summary line above the field list:

```
Preparing 32 fields · 12 complete · ~4 min remaining
━━━━━━━━━━━━━░░░░░░░░ 38%
```

Uses `--text-xs`, `--text-muted`. Thin 2px progress bar with `--status-positive` fill. Appears/disappears with 200ms fade.

**Component:** `OnboardingBatchSummary` — reads from the existing `onboardingProgress` map.

---

### Moment 3 — "I opened a field that's still hydrating"

**Current:** Scattered ValueSlot placeholders (gray pulse bars), empty chart text. Feels broken.

**Target:** Replace the disjointed loading state with a **Hydration Stage Tracker** that appears at the top of the field detail view when the field is still onboarding.

```
┌─────────────────────────────────────────────┐
│                                             │
│  Preparing Main Farm                        │
│                                             │
│  ● Soil properties      Fetched             │
│  ● Weather observations  Collecting...      │
│  ○ Satellite imagery     Queued             │
│  ○ Moisture model        Waiting            │
│                                             │
│  Data appears below as each step completes. │
│                                             │
└─────────────────────────────────────────────┘
```

**Stage definitions** (mapped from worker `progressMessage`):

| Stage Key | Label | Worker phases matched |
|-----------|-------|---------------------|
| `soil` | Soil properties | "enriching field soil properties" |
| `weather` | Weather observations | "refreshing field weather" |
| `imagery` | Satellite imagery | "syncing latest field imagery" |
| `moisture` | Moisture model | "rebuilding field moisture estimate", "rebuilding field moisture cells" |

**Visual rules:**
- Each stage is a row: status dot (8px) + label (Sintony `--text-sm`) + status text (right-aligned, `--text-muted`)
- Completed: filled green dot (`--status-positive`), label at full opacity, status = "Fetched" / "Collected" / "Acquired" / "Computed"
- Active: pulsing green dot (uses `pulseGentle` keyframe), label at full opacity, status = "Collecting..." in `--status-info`
- Pending: hollow gray dot (`--color-slate-200` border), label at 50% opacity, status = "Queued" in `--text-muted`
- Failed: red dot (`--status-danger`), status = "Retry queued" — don't scare the farmer

**Transitions:**
- Stage completion: dot fills with 300ms ease, status text crossfades (150ms)
- All complete: entire tracker fades out (400ms) and the summary/report tabs reload with fresh data
- ValueSlot arrivals in the tabs below cascade with 50ms stagger as data populates

**Data source:** Derive stage status from the existing `JobDispatchSnapshot.progressMessage` string. The worker already emits these — just parse them into stage keys.

**Component:** `HydrationStageTracker` — receives `jobSnapshot: JobDispatchSnapshot | null`, derives stages.

---

### Moment 4 — "Soil data just arrived"

**Current:** No signal. Model silently switches from defaults to real soil.

**Target:** When soil stage completes:
- Stage tracker updates (dot fills green, status = "Fetched")
- If user is on SummaryTab: no metric change visible yet (soil alone doesn't populate user-facing values)
- If user is on ReportTab: soil-dependent text might update (depletion basis label)

**No new component needed.** The stage tracker handles the visual signal.

---

### Moment 5 — "Weather data just arrived"

**Current:** Temperature chart might go from empty to populated, but no cohesive signal.

**Target:** When weather stage completes:
- Stage tracker updates
- Temperature Window chart in ReportTab: chart area transitions from empty text → rendered sparkline with a 400ms `fadeSlideUp` animation
- SummaryTab weather metrics (if any) animate via ValueSlot arrival

**New CSS animation for chart entrance:**

```css
@keyframes chartReveal {
  0%   { opacity: 0; transform: translateY(8px); }
  100% { opacity: 1; transform: translateY(0); }
}

.chart-section--arriving {
  animation: chartReveal 400ms cubic-bezier(0.16, 1, 0.3, 1) both;
}
```

**Component change:** `fieldDetailReportSubPage.tsx` — wrap chart sections in a container that applies `.chart-section--arriving` when data transitions from empty → populated. Detect via `prevPointsRef` tracking.

---

### Moment 6 — "Satellite imagery arrived"

**Current:** Map gets imagery tiles. Status dot should complete. Vegetation + moisture charts might populate.

**Target:** This is the hero moment. When imagery arrives:
- Stage tracker: imagery dot fills green
- **Map boundary glow**: the field boundary on the map briefly pulses with a green border-glow (2 frames, 600ms total) to draw the eye. This is the moment the map goes from wire outline to satellite view.
- Vegetation chart and moisture chart in ReportTab: apply `chartReveal` entrance
- SummaryTab moisture/NDVI metrics: ValueSlot cascade arrival with 50ms stagger

**Map glow implementation:** Add a temporary `field-boundary--imagery-arrived` class to the MapLibre boundary layer style. Uses `line-opacity` transition from 0.8 → 0 over 600ms with `--status-positive` color. Remove class after animation.

---

### Moment 7 — "Everything is ready"

**Current:** Polling stops. Card transitions to normal state. No completion signal.

**Target:** Multi-layered completion:

1. **Stage tracker farewell** — all 4 dots green, brief hold (500ms), then the entire tracker fades out with a 400ms ease. The space collapses smoothly (use `max-height` transition, not `display: none`).

2. **Field strip card completion pulse** — the existing `field-strip__card--completed` class. Extend it: green border-bottom does a single bright flash (opacity 0.35 → 0.8 → 0.35 over 600ms), then the card transitions to normal styling (phase label replaced by location, name at full opacity).

3. **Completion toast** (only for single-field creates, not batch) — a minimal toast notification:

```
┌─────────────────────────────────┐
│  ✓  Main Farm is ready          │
└─────────────────────────────────┘
```

Appears bottom-right, stays 3s, fades out. Uses `--status-positive` left border accent.

**For batch completion** (all 32 fields done) — show a summary toast:

```
┌─────────────────────────────────────┐
│  ✓  All 32 fields ready             │
│     Total time: 8 min 23 sec        │
└─────────────────────────────────────┘
```

4. **Sidebar batch summary dismissal** — the `OnboardingBatchSummary` bar transitions from "Preparing 32 fields" to "All fields ready ✓" (hold 2s) then fades out.

**Component:** `HydrationToast` — minimal toast with auto-dismiss. Position fixed, bottom-right, z-index above panels.

---

## Component Inventory

| Component | Type | New/Modify | Complexity |
|-----------|------|-----------|------------|
| `CommitConfirmationCard` | Presentational | New | Small |
| `OnboardingBatchSummary` | Connected (reads onboardingProgress) | New | Small |
| `HydrationStageTracker` | Connected (reads jobSnapshot) | New | Medium |
| `HydrationToast` | Presentational + timer | New | Small |
| `FieldStatusDot` | Existing | No change | — |
| `ValueSlot` | Existing | No change | — |
| `FieldStrip` | Existing | Minor CSS additions | Small |
| `fieldDetailReportSubPage` | Existing | Add chart entrance class | Small |

**New CSS additions to `globals.css`:**
- `@keyframes chartReveal` — chart section entrance
- `.chart-section--arriving` — applied on data transition
- `.field-strip__card--entering` stagger delay — cascade animation
- `.onboarding-batch-summary` — batch progress bar
- `.hydration-stage-tracker` — stage tracker layout
- `.hydration-toast` — toast positioning and entrance/exit

---

## Implementation Order

### Phase 1 — Core stage visibility (highest impact, ~3h)
1. `HydrationStageTracker` component
2. Wire into `FieldPageShell` / `FieldDetailPanel` — show when field has active onboarding
3. Parse `progressMessage` from job snapshot into stage states
4. Stage completion transitions (dot fill, label crossfade)
5. Tracker fadeout on all-complete

### Phase 2 — Sidebar polish (~2h)
1. Card entrance stagger for batch imports
2. Phase label crossfade transition
3. `OnboardingBatchSummary` component above field list
4. Card completion flash animation

### Phase 3 — Data arrival choreography (~2h)
1. Chart section entrance animation (`chartReveal`)
2. ValueSlot staggered cascade on data refresh
3. Map boundary glow on imagery arrival

### Phase 4 — Bookend moments (~1h)
1. `CommitConfirmationCard` in AddFieldPanel
2. `HydrationToast` for single + batch completion

---

## What NOT to build

- No skeleton screens for charts (the existing empty text is fine during hydration since the stage tracker explains why)
- No progress percentages on individual stages (too granular, feels like a loading bar)
- No sound effects or haptics
- No confetti or celebration animations — this is a farming tool, keep it grounded
- No dark mode variants (design system says no dark mode)

---

## Design System Compliance

All new components must use:
- `--font-body` (Sintony) for all text
- `--text-xs` / `--text-sm` for metadata and labels
- `--text-muted` (#8a8f98) for secondary text
- `--status-positive` (#16a34a) for completion signals
- `--status-info` (#3b82f6) for active/in-progress states
- `--color-slate-200` (#e2e8f0) for unfilled/pending elements
- `--space-*` tokens for all spacing
- `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo) for all entrance animations
- `ease` for all exit/fade animations
- Dual shadow `var(--shadow-card)` for any elevated containers
