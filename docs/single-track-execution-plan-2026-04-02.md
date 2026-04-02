# FieldPulse Single-Track Execution Plan

Last updated: 2026-04-02

This document exists to remove ambiguity about product direction.

FieldPulse-v3 is the active product and release line.
NocFarm is not an active product roadmap input. It may still contain useful ideas or copy patterns, but it is not a source of truth for architecture, UX, or launch readiness.

## Product decision

We are not running two live product tracks.

From this point forward:

- all shipping work happens in `/Users/ojieame/FieldPulse-v3`
- all launch-readiness decisions are made against `FieldPulse-v3`
- no new feature work should begin in `NocFarm`
- if a useful idea exists in `NocFarm`, it must be ported intentionally into `FieldPulse-v3` or ignored

## Current state

FieldPulse-v3 is credible enough for a controlled beta, but not yet for a broad production claim.

What is already true:

- the data and worker architecture are real and deep
- the first-insight chooser and preview guidance now exist
- spring agronomic logic has advanced materially
- controlled beta access and request-access flows exist
- import and hydration UX are credible enough to use

What is still weak:

- the sign-up to first-insight journey is not yet proven with a real grower
- the product still behaves more like an inspection tool than a habit-forming decision system
- launch-visible field quality is still uneven across a full workspace
- billing and commercial readiness are still missing

## What this means

The main risk is no longer backend correctness.

The main risks are:

1. first-time user success
2. repeat-use habit loop
3. field readiness across launch-visible workspaces
4. commercialization and support readiness

## Execution order

### Phase 1: Merge the import-speed fix

First action:

- merge [PR #4](https://github.com/ojieame12/nocpulse-final/pull/4)

Why first:

- it removes synchronous spreadsheet hydration work from the request path
- it directly addresses a real add-field/import pain point
- it improves perceived speed without changing the UI contract

Success criteria:

- spreadsheet import commits return quickly
- hydration and crop-context work complete in background onboarding
- no regression in queued hydration summaries or add-field UX

### Phase 2: Prove the first-insight journey

Run one real grower through the full path:

1. request access
2. sign in
3. add or import fields
4. wait for hydration
5. land on the first useful field insight

Capture where friction appears:

- access confusion
- empty workspace confusion
- hydration waiting confusion
- weak first field selection
- unclear confidence or explanation

Success criteria:

- one real grower reaches a useful first insight without operator coaching
- the friction list is written down and prioritized

### Phase 3: Finish one proactive alert loop

Pick one alert type and make it complete before adding more scope.

Recommended first alert:

- field changed materially since last review

Every alert must include:

- why it triggered
- what source supports it
- confidence level
- what to review next
- reviewed / dismissed / snoozed state

Success criteria:

- one alert type runs end to end on live fields
- it is trusted enough to bring users back into the product
- weak, stale, or thin fields do not generate strong alerts

### Phase 4: Raise launch-visible field quality

Do not let long-tail weak fields define first impressions.

Keep the existing ops loop focused on:

- `vegetation-empty -> thin`
- `thin -> ready`

Use launch-visible allowlists and readiness gates so only strong fields lead the experience.

Success criteria:

- launch-visible workspaces are majority `ready`
- first impressions do not depend on arbitrary field ordering

### Phase 5: Commercial readiness

Do not start broad billing work before the core product path is stable.

Only move here after:

- import is fast and reliable
- first insight is proven
- one alert loop is trusted
- launch-visible readiness is acceptable

Then add:

- billing
- account/admin controls
- support workflows
- rollout tooling and customer operations

## Guardrails

- no dual-track product planning across repos
- no redesign unless it directly unblocks first-insight or repeat-use behavior
- prefer copy, logic, and existing-surface improvements before layout changes
- use `FieldPulse-v3` docs as the source of truth for launch status

## Immediate next actions

1. merge PR #4
2. deploy `main`
3. run one real grower walkthrough
4. choose and finish the first alert loop
5. continue launch-visible field promotion

## Related documents

- [productization-execution-plan.md](/Users/ojieame/FieldPulse-v3/docs/productization-execution-plan.md)
- [launch-go-no-go.md](/Users/ojieame/FieldPulse-v3/docs/launch-go-no-go.md)
- [week-1-implementation-checklist.md](/Users/ojieame/FieldPulse-v3/docs/week-1-implementation-checklist.md)
