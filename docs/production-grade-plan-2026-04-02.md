# FieldPulse Production-Grade Plan

Last updated: 2026-04-02

This document defines the next work required to move `/Users/ojieame/FieldPulse-v3` from controlled beta readiness toward a broader production-grade claim.

It assumes the current shipped baseline is already true:

- the core agronomic pipeline is live
- add-field failure recovery is materially better
- launch-visible field gating is in place
- the material-change alert loop exists
- first-insight funnel reporting exists

The remaining gaps are no longer mostly architectural. They are product trust, field-quality consistency, and commercialization readiness.

## Current verdict

- Controlled beta: `GO`
- Broad production claim: `NO-GO`

Why:

- the codebase is stable enough to operate
- the first-insight path is stronger than before, but not yet proven with a real grower
- launch-visible field quality is still too uneven across the long tail
- moisture confidence and validation are not strong enough to support broader authoritative claims
- billing and commercial controls are still missing

## Production-grade goal

Reach a state where:

1. a new grower can get from sign-up to first useful insight without coaching
2. first impressions are driven by strong fields, not arbitrary field ordering
3. proactive alerts are trusted and low-noise
4. weak-confidence fields do not generate strong claims
5. billing and access controls can be introduced without exposing an unstable core experience

## Phase 1: Prove the first-insight journey

Run 1-3 real grower walkthroughs through the full product path:

1. request access
2. sign in
3. add or import fields
4. wait for hydration
5. land on the first useful field insight

Capture friction exactly where it appears:

- access confusion
- add-field confusion
- hydration waiting confusion
- weak first field selection
- unclear explanation or confidence language

Use the existing shipped instrumentation:

- funnel reporting
- launch-visible field gating
- intake retry and hydration retry paths

Success criteria:

- at least one real grower completes the flow without operator coaching
- first insight is reached in one session
- the friction list is written down and prioritized

## Phase 2: Harden field quality

Do not let long-tail weak fields define the product.

Focus on:

- suppressing `thin`, `fallback`, weak-confidence, and stale fields from first-impression surfaces
- keeping launch-visible allowlists strict
- improving the ready share in Hope Creek and Dev Farm
- verifying live soil enrichment and moisture-source completeness on newly added fields

Operational goal:

- curated and launch-visible workspaces should feel consistently strong even if the long tail is still maturing

Success criteria:

- first impressions no longer depend on arbitrary field ordering
- strong summaries and strong claims are not built from weak fields
- long-tail field readiness trends improve over time

## Phase 3: Tune the alert loop until it is trusted

The material-change loop exists. The next step is to make it reliable enough to keep.

Track:

- false positives
- stale-field suppression
- thin-field suppression
- reviewed vs dismissed behavior
- whether alerts lead to real follow-up actions

Do not add more alert scope until one alert loop is trusted.

Success criteria:

- alerts are explainable and low-noise
- review and dismiss actions are used meaningfully
- weak or stale fields do not generate strong alerts

## Phase 4: Decompose add-field implementation safely

`AddFieldPanel.tsx` is now large enough to be a maintenance risk.

Decompose it only after the walkthrough findings are known, and do it without changing:

- panel layout
- map behavior
- hydration shell behavior

Split by concern:

- LLD flow
- spreadsheet flow
- geofile flow
- onboarding and hydration status
- shared retry and error presentation

Success criteria:

- smaller, safer code paths
- no layout regressions
- add-field retry and failure handling remain covered by tests

## Phase 5: Commercial readiness

Do not start broad billing work before the trust path is stable.

Only move here after:

- the first-insight journey is proven
- launch-visible field quality is acceptable
- one alert loop is trusted

Then add:

- plans and entitlements
- billing and checkout
- account and admin controls
- support and rollout tooling

Success criteria:

- billing is attached to a product users can reliably use
- production claims match actual field quality and user success rates

## Guardrails

- no redesign unless it directly unblocks first-insight or repeat-use behavior
- no map or panel-shell changes as part of maintenance cleanup
- prefer copy, logic, routing, and gating fixes before layout changes
- treat trust and evidence quality as release criteria, not just feature count

## Recommended next actions

1. run a real grower walkthrough
2. log and prioritize first-insight friction
3. tighten field-quality suppression where weak fields still leak into strong claims
4. monitor and tune the material-change alert loop
5. decompose `AddFieldPanel.tsx` after the walkthrough findings are in hand
6. start billing only after the above are stable

## Related documents

- [launch-go-no-go.md](/Users/ojieame/FieldPulse-v3/docs/launch-go-no-go.md)
- [productization-execution-plan.md](/Users/ojieame/FieldPulse-v3/docs/productization-execution-plan.md)
- [single-track-execution-plan-2026-04-02.md](/Users/ojieame/FieldPulse-v3/docs/single-track-execution-plan-2026-04-02.md)
