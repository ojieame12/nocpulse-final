# FieldPulse Week 1 Implementation Checklist

Last updated: 2026-04-02

This checklist is the execution layer for:

- [productization-execution-plan.md](/Users/ojieame/FieldPulse-v3/docs/productization-execution-plan.md)
- [launch-go-no-go.md](/Users/ojieame/FieldPulse-v3/docs/launch-go-no-go.md)

It is intentionally limited to the first week of work. The goal is not to solve the whole product in seven days. The goal is to make the next engineering steps concrete, testable, and hard to misinterpret.

## Week 1 goal

Make the first-use path legible and measurable while keeping field quality improvement running in the background.

By the end of Week 1, the team should have:

- a defined first-insight journey
- a fixed launch-visible field list
- a concrete UI insertion plan for guided interpretation
- a repeatable field-quality reporting loop
- an active richness-improvement loop for Hope Creek and Dev Farm

## Workstream A: Define the first-insight journey

### Deliverable

A written first-use flow that answers:

1. what the user sees first
2. which field is opened first
3. what insight is highlighted first
4. what action or interpretation is suggested next

### Required output

Add a short spec section to:
- [productization-execution-plan.md](/Users/ojieame/FieldPulse-v3/docs/productization-execution-plan.md)

Include:
- target user: new grower with no prior product training
- first insight: wettest field, driest field, or most changed field
- rejection rule: do not choose `thin`, `fallback`, or `broken` fields for the first field
- explanation rule: confidence and data quality must be visible beside the first insight

### Code surfaces to review

- [PreviewShell.tsx](/Users/ojieame/FieldPulse-v3/apps/web/src/app/preview/PreviewShell.tsx)
- [FieldPageShell.tsx](/Users/ojieame/FieldPulse-v3/apps/web/src/features/fields/FieldPageShell.tsx)
- [FieldDetailPanel.tsx](/Users/ojieame/FieldPulse-v3/apps/web/src/components/panels/FieldDetailPanel.tsx)
- [SummaryTab.tsx](/Users/ojieame/FieldPulse-v3/apps/web/src/components/panels/SummaryTab.tsx)

### Exit criteria

- one paragraph exists describing the exact first-insight path
- first field selection is explicit, not left to current incidental ordering

## Workstream B: Lock the launch-visible field list

### Deliverable

A documented shortlist of fields allowed in launch demos and first-use product surfaces.

### Required output

Create a dedicated section in:
- [demo-readiness-live-2026-04-01.md](/Users/ojieame/FieldPulse-v3/docs/demo-readiness-live-2026-04-01.md)

Document:
- launch-visible Hope Creek fields
- excluded fields
- reason for exclusion

### Current starting point

Best known Hope Creek set:
- `Main Farm`
- `Rath`
- `Rath West`
- `Robbie`
- `Roman East Q`
- `Roman Yard`
- `Sigurson`
- `Solomon`
- `Towes`
- `Towes Dugout`

### Rules

- no `fallback`
- no `broken`
- avoid fields with empty vegetation or visibly incomplete field detail panels
- if a field is only suitable for moisture but not vegetation storytelling, do not put it in the default launch-visible set

### Exit criteria

- one explicit list of allowed fields exists
- one explicit list of excluded fields exists
- the product team is not choosing demo fields ad hoc

## Workstream C: Insert guided interpretation into the field UI

### Deliverable

A minimal design and implementation target for the first field-level interpretation block.

### Required product decision

The first interpretation block should answer all three:
- what this field is telling me
- how much I should trust it
- what I should look at next

### Target insertion points

- [FieldDetailPanel.tsx](/Users/ojieame/FieldPulse-v3/apps/web/src/components/panels/FieldDetailPanel.tsx)
- [SummaryTab.tsx](/Users/ojieame/FieldPulse-v3/apps/web/src/components/panels/SummaryTab.tsx)
- [buildFieldOverviewViewModel.ts](/Users/ojieame/FieldPulse-v3/apps/web/src/features/fields/buildFieldOverviewViewModel.ts)

### Week 1 scope

Do not build a full onboarding wizard yet.

Instead:
1. define the exact copy and data inputs for one interpretation block
2. define its display rules
3. define its suppression rules

Minimum rules:
- show only on `ready` or strong `limited` fields
- include data quality state
- include moisture confidence context
- never imply anomaly intelligence when anomaly enrichment is absent

### Exit criteria

- one implementation-ready spec exists for the interpretation block
- target files and data dependencies are known
- no ambiguity remains about where the block should live

## Workstream D: Keep daily field-quality reporting alive

### Deliverable

A repeatable daily audit loop using the worker tools already built.

### Commands

```bash
corepack pnpm -C /Users/ojieame/FieldPulse-v3-worker-main-live/apps/worker run report:quality -- --workspace-slug hope-creek-farms --json
corepack pnpm -C /Users/ojieame/FieldPulse-v3-worker-main-live/apps/worker run report:quality -- --workspace-slug fieldpulse-dev-farm --json
corepack pnpm -C /Users/ojieame/FieldPulse-v3-worker-main-live/apps/worker run health -- --json
```

### Required output

Record daily:
- `ready`
- `thin`
- `fallback`
- `broken`
- `vegetation-empty`
- `vegetation-thin`
- queue health

### Exit criteria

- one daily field-quality snapshot is produced for both target workspaces
- readiness trends can be compared day over day

## Workstream E: Continue field richness promotion

### Deliverable

A controlled daily repair loop for Hope Creek and Dev Farm.

### Commands

First-pass repair:

```bash
corepack pnpm -C /Users/ojieame/FieldPulse-v3-worker-main-live/apps/worker run imagery:optical-backfill -- --workspace-slug fieldpulse-dev-farm --qualities thin --max-fields 3 --target-count 1 --windows 1 --lookback-days 45 --json
```

Second-pass promotion:

```bash
corepack pnpm -C /Users/ojieame/FieldPulse-v3-worker-main-live/apps/worker run imagery:optical-backfill -- --workspace-slug fieldpulse-dev-farm --qualities thin --min-optical-count 1 --max-fields 2 --target-count 2 --windows 1 --lookback-days 45 --json
```

### Rules

- never flood the queue
- favor small batches
- rerun quality audit after every batch
- stop if stale runners appear

### Exit criteria

- the loop remains operationally safe
- week-over-week readiness improves
- launch-visible fields remain strong

## Verification checklist

By the end of Week 1, verify all of the following:

- first-insight journey is documented
- launch-visible field list is fixed
- interpretation block is implementation-ready
- daily field-quality reports are being produced
- optical repair continues without destabilizing the queue

## Explicitly not in Week 1

Do not spend Week 1 on:
- generic collaboration features
- large alert-system expansion
- cosmetic landing-page work unrelated to first insight
- broad new reporting features

If a task does not improve:
- first-use clarity
- field richness
- alert honesty
- or validation trust

it should not displace this checklist.
