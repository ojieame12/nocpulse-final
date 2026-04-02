# FieldPulse Productization Execution Plan

Last updated: 2026-04-02

This plan exists to close the gap between:

- a technically credible curated demo
- and a product that teaches a grower what matters, explains what changed, and earns repeat usage across an entire workspace

It is deliberately focused on the current thin spots:

1. guided first-insight onboarding
2. proactive intelligence / alert loop
3. long-tail field richness
4. validation quality and confidence honesty

## Current baseline

### Field quality

- Hope Creek:
  - `33` fields
  - `15 ready`
  - `18 thin`
  - `0 fallback`
  - `0 broken`
- Dev Farm:
  - `97` fields
  - `25 ready`
  - `72 thin`
  - `0 fallback`
  - `0 broken`
  - dominant long-tail issues:
    - `vegetation-thin: 41`
    - `vegetation-empty: 31`
    - `moisture-history-thin: 9`

### Product state

- hydration and import UX are credible
- moisture source integrity is strong
- anomaly-dependent UI is more honest because incomplete context is hidden
- AppEEARS-backed SMAP validation is live and runnable
- first-insight field selection is now deliberate instead of defaulting to incidental import order
- a workspace-level first summary is now live in preview for ready fields
- the first field-level interpretation block is now live in the default field view

### Current business risks

- a new grower still does not get a proven sign-up-to-first-insight journey
- the platform still behaves more like an inspection tool than a repeat-use decision system
- broad field richness is uneven outside curated demo fields
- validation exists, but current scored sample quality is not strong enough for aggressive accuracy claims

## Success criteria

FieldPulse should be considered meaningfully productized only when all of the following are true:

- a real grower can sign up and reach a first useful field insight without prior coaching
- at least one proactive alert loop is live, explainable, and trusted
- the majority of launch-visible fields in target workspaces are `ready`, not `thin`
- confidence labels visibly downgrade weak or stale data
- validation reports can be run repeatedly and do not materially contradict confidence claims

## Workstreams

### Workstream 1: First-Insight Onboarding

Owner:
- Product / Web

Problem:
- the product currently assumes the user already understands moisture, imagery, and confidence
- there is no proven first-use journey from account creation to actionable field insight

Build:
1. Define the first-insight path.
   - target outcome: “I understand my wettest field, driest field, and what changed this week”
2. Add an onboarding state model.
   - new user
   - imported but not hydrated
   - hydrated but not interpreted
   - first insight completed
3. Add guided interpretation blocks to the first visible field.
   - what this number means
   - why confidence is high/medium/low
   - what changed recently
   - what action to consider next
4. Add a simple workspace-level first summary.
   - wettest field
   - driest field
   - most changed field
   - next recommended review
5. Run one real grower walkthrough and capture friction.

#### First-insight journey spec

Target user:
- a new grower with no prior product training

Entry point:
- after import commit succeeds and the workspace has at least one hydrated field
- the first visible experience must not depend on incidental field ordering

First field selection rule:
1. start from the launch-visible allowlist when one exists for the workspace
2. otherwise start from all fields in the current import/workspace result
3. exclude any field marked `thin`, `fallback`, or `broken`
4. prefer fields that are both:
   - `ready`
   - source-backed with visible confidence and data-quality support
5. if multiple candidates remain, rank them in this order:
   - best narrative slot for the workspace summary: wettest, driest, or most changed
   - highest trust signal: `Ready` data quality and `high`/`medium` moisture confidence
   - explicit product shortlist order for launch/demo workspaces
6. if no candidate survives the filter, do not auto-open a random field
   - keep the user in a workspace-level “data still gathering” state instead

First insight shown:
- one workspace-level summary card introduces the chosen field as the first place to look
- the field detail panel opens on that same field
- the first interpretation block answers:
  - what this field is telling me
  - how much I should trust it
  - what I should review next

Trust and explanation rules:
- data quality must be visible beside the first insight
- moisture confidence and provenance must be visible beside the first insight
- thin, fallback, stale, or anomaly-incomplete fields must not be framed as strong first insights
- if the field is only partially usable, the UI must say so plainly instead of promoting it as a top result

Current implementation hooks:
- [PreviewShell.tsx](/Users/ojieame/FieldPulse-v3/apps/web/src/app/preview/PreviewShell.tsx)
  - currently reveals and switches using `preferredFieldId ?? fieldIds[0]`
- [FieldPageShell.tsx](/Users/ojieame/FieldPulse-v3/apps/web/src/features/fields/FieldPageShell.tsx)
  - currently routes to the single returned `preferredFieldId`
- [buildFieldOverviewViewModel.ts](/Users/ojieame/FieldPulse-v3/apps/web/src/features/fields/buildFieldOverviewViewModel.ts)
  - already computes the field-level data quality and confidence inputs the chooser needs
- [FieldDetailPanel.tsx](/Users/ojieame/FieldPulse-v3/apps/web/src/components/panels/FieldDetailPanel.tsx)
- [SummaryTab.tsx](/Users/ojieame/FieldPulse-v3/apps/web/src/components/panels/SummaryTab.tsx)
  - these are the correct surfaces for the first interpretation block

Implementation direction:
- replace incidental first-field selection in the shells with one shared chooser
- drive that chooser from launch-visible allowlists plus field quality and moisture confidence
- add the first interpretation block only after the chooser is deterministic

Dependencies:
- current hydration summary path
- field data quality indicator
- existing field detail panel and preview shells

Exit criteria:
- one real new account can import fields and reach a first insight without operator explanation
- onboarding copy is explicit about modeled vs measured vs thin data
- the first field shown is intentionally chosen, not arbitrary
- the preview shell introduces the chosen field with a workspace-level comparison summary before deeper field inspection

### Workstream 2: Proactive Intelligence / Alert Loop

Owner:
- Backend / Product

Problem:
- the system can be inspected, but it does not yet consistently pull the user back in
- anomaly intelligence is not complete enough to power trustworthy field-change alerts

Build:
1. Choose one alert loop to finish first.
   - recommended first loop: “field changed materially since last review”
2. Finish the anomaly enrichment path or explicitly narrow scope to a simpler change detector.
3. Ensure every alert includes:
   - why it triggered
   - source support
   - confidence level
   - recommended next action
4. Suppress alerts on `thin`, `fallback`, or stale fields.
5. Add per-alert review state.
   - new
   - reviewed
   - dismissed
   - snoozed

Dependencies:
- historical context and report read model
- moisture confidence and provenance
- alert persistence and field-level review actions

Exit criteria:
- one proactive alert type runs end to end on live fields
- it is explainable and not backed by incomplete anomaly placeholders
- users are not alerted from weak-confidence or stale data

### Workstream 3: Field Richness Expansion

Owner:
- Worker / Ops

Problem:
- the curated demo set is strong
- average workspace quality is still too uneven for broad launch claims

Build:
1. Keep daily `fieldQualityAudit` reporting.
2. Continue audit-driven optical repair and second-pass promotion.
3. Set readiness targets by workspace.
   - Hope Creek: push beyond curated demo strength
   - Dev Farm: reduce `thin` share materially
4. Treat `vegetation-empty` and `vegetation-thin` as separate queues.
   - first pass: `empty -> thin`
   - second pass: `thin -> ready`
5. Add a “launch-visible fields” list so the product only surfaces fields above a minimum readiness threshold.

Operational targets:
- no demo-visible field is `fallback` or `broken`
- long-tail workspaces trend toward majority `ready`
- worker queue stays healthy without manual babysitting

Exit criteria:
- launch-visible workspaces have majority-ready fields
- field richness improves through a repeatable loop, not manual rescue

### Workstream 4: Validation And Confidence Calibration

Owner:
- Model / Validation

Problem:
- AppEEARS-backed SMAP validation now works, but the first legitimate scored sample is weak
- confidence labels must stay aligned with observed validation quality

Build:
1. Expand the scored sample set.
   - more overlap days
   - more fields
   - more than one workspace
2. Keep excluding bootstrap, missing-provenance, and non-source-backed samples from metrics.
3. Tune confidence policy against live results.
   - stale + neutral/divergent agreement should not be `high`
4. Record validation artifacts per run.
   - scored dates
   - excluded dates
   - metrics
   - notes on source freshness
5. Set marketing language by validation reality.
   - decision support if metrics remain weak
   - stronger agronomy claims only after repeated acceptable results

Current known result:
- first legitimate scored sample:
  - `matchedDates: 3`
  - `RMSE: 6.41`
  - `MAE: 6.32`
  - `Pearson r: -0.895`
  - `bias: 6.32`

Exit criteria:
- confidence policy and validation results tell the same story
- validation is repeatable, not a one-off
- strong public accuracy language is blocked until the numbers support it

## Execution order

### Phase A: Make first use legible

1. finish first-insight journey design
2. choose launch-visible fields
3. ship onboarding interpretation blocks

### Phase B: Make repeat usage real

1. finish one proactive alert loop
2. keep suppressing alerts on weak fields
3. track alert review behavior

### Phase C: Raise average field quality

1. keep audit-driven optical repair running
2. improve launch-visible workspace readiness
3. operationalize field richness reporting

### Phase D: Tighten truth claims

1. expand SMAP/AppEEARS scored samples
2. keep calibrating confidence against external validation
3. set product language by measured validation quality

## 30-day execution checklist

### Week 1

- document the first-insight user journey
- define the launch-visible field list
- keep daily field quality reporting running
- continue Dev Farm and Hope Creek richness promotion

### Week 2

- ship the first field-level interpretation layer
- choose and implement the first alert loop
- block alerts on thin/fallback/stale fields

### Week 3

- run real grower onboarding sessions
- tighten onboarding copy from feedback
- expand SMAP validation runs across more fields

### Week 4

- review launch-visible workspace readiness
- review alert usefulness and false positives
- review validation quality vs confidence labels
- decide whether launch language stays “decision support” or can be strengthened

## Non-goals

These are intentionally not the primary focus of this plan:

- generic collaboration features
- multi-user workflow polish
- broad new feature expansion unrelated to first insight, repeat usage, or data trust

Those can matter later, but they are not the main blockers today.

## Decision rule

If there is a conflict between:

- adding a new feature
- and making onboarding, alert usefulness, field richness, or validation more trustworthy

choose trust and repeatability first.
