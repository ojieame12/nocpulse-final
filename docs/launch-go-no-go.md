# NocPulse Launch GO / NO-GO

Last updated: 2026-04-02

This checklist is meant to answer one question:

Can `/Users/ojieame/FieldPulse-v3` be released as a controlled production beta without hiding known engineering risk?

## Current verdict

- Controlled beta: `CONDITIONAL GO`
- Broad production claim: `NO-GO`
- "Authoritative agronomy/moisture platform" claim: `NO-GO`

The codebase is healthy enough to ship behind a managed rollout, but the field-level data readiness and product guidance are still uneven. The main blocker is no longer architecture. It is operational completeness plus whether an average grower gets a guided first insight instead of a dense field dashboard.

## Current evidence

### Code health

- `PASS` `corepack pnpm -C /Users/ojieame/FieldPulse-v3/apps/web exec tsc --noEmit`
- `PASS` `corepack pnpm -C /Users/ojieame/FieldPulse-v3/apps/worker exec tsc --noEmit`
- `PASS` `corepack pnpm -C /Users/ojieame/FieldPulse-v3 test:runtime-intelligence`
- `PASS` `corepack pnpm -C /Users/ojieame/FieldPulse-v3 test:reports-read-model`
- `PASS` `corepack pnpm -C /Users/ojieame/FieldPulse-v3 test:web-preview-entry`

### Repo state

- `WARN` `HEAD` matches `origin/main` (`a22823b`), but the checkout is on `codex/preview-shell-boundaries`, not `main`
- `FAIL` working tree is noisy and not release-clean
- `WARN` local changes include:
  - `.next-dev-*` cache churn
  - `package.json` adding `geotiff`
  - untracked `package-lock.json`
  - untracked `packages/pdf/test-density.ts`

### Workspace readiness snapshots

#### FieldPulse Dev Farm (`a625a72d-a2de-43ee-8bb4-aad93466f750`)

- `PASS` source utilization:
  - `fieldCount: 97`
  - `missingMoistureSnapshotCount: 0`
  - `seededMoistureCount: 0`
  - `syntheticRasterCount: 0`
  - `providerRasterCount: 97`
  - `rasterAndWeatherBlendCount: 97`
  - `fieldsUsingWeather: 97`
  - `fieldsMissingBaselineDataset: 0`
- `WARN` quality baseline:
  - `fieldCount: 97`
  - `ready: 25`
  - `thin: 72`
  - `fallback: 0`
  - `broken: 0`
  - dominant long-tail issues:
    - `vegetation-thin: 41`
    - `vegetation-empty: 31`
    - `moisture-history-thin: 9`

#### Hope Creek (`8f2afceb-aefe-4e90-a24e-7ab07c4423fe`)

- `WARN` quality baseline:
  - `fieldCount: 33`
  - `ready: 15`
  - `thin: 18`
  - `fallback: 0`
  - `broken: 0`
  - curated demo subset is strong, but long-tail fields remain vegetation-thin

Interpretation:

- the moisture pipeline itself is running and source-backed
- the chart/report readiness across fields is still uneven
- launch quality depends on which fields users see first
- the product is strongest for someone who already knows how to read moisture, imagery, and confidence
- the remaining gap is not just data completeness, but lack of a guided first-insight journey for growers

## Product thin spots

- `WARN` guided onboarding is still weak:
  - the first-insight chooser, workspace summary, and interpretation block are now in place
  - the remaining gap is proving the full sign-up-to-first-insight journey with a real grower
- `WARN` proactive habit loop is still incomplete:
  - explainable actions and alert scaffolding exist
  - anomaly-driven field change intelligence is still incomplete or intentionally hidden when unsupported
- `WARN` long-tail field richness is still uneven:
  - curated demo fields are credible
  - average-workspace consistency is not there yet, especially on vegetation history depth
  - Dev Farm improved to `25 ready`, but `72` fields are still `thin`

Interpretation:

- this is no longer primarily a backend-correctness problem
- it is now a productization and habit-formation problem
- the biggest business risks are:
  - first-insight onboarding
  - proactive intelligence / alert loop
  - broad field richness across an entire workspace

## Launch gates

### Gate 1: Release hygiene

- `GO` if:
  - the repo is on an intentional release branch or `main`
  - no generated `.next-dev-*` files are mixed into the release scope
  - `package-lock.json` is either removed or intentionally adopted
- `NO-GO` if:
  - release candidates are assembled from a dirty worktree
  - source and generated churn are mixed together

Commands:

```bash
git -C /Users/ojieame/FieldPulse-v3 status --short --branch
git -C /Users/ojieame/FieldPulse-v3 log --oneline --decorate -10
```

Current status: `NO-GO`

### Gate 2: Static correctness

- `GO` if:
  - web typecheck passes
  - worker typecheck passes
- `NO-GO` if either fails

Commands:

```bash
corepack pnpm -C /Users/ojieame/FieldPulse-v3/apps/web exec tsc --noEmit
corepack pnpm -C /Users/ojieame/FieldPulse-v3/apps/worker exec tsc --noEmit
```

Current status: `GO`

### Gate 3: Core runtime/regression safety

- `GO` if:
  - runtime intelligence tests pass
  - report read-model tests pass
  - preview routing tests pass
- `NO-GO` if any regression appears in these core flows

Commands:

```bash
corepack pnpm -C /Users/ojieame/FieldPulse-v3 test:runtime-intelligence
corepack pnpm -C /Users/ojieame/FieldPulse-v3 test:reports-read-model
corepack pnpm -C /Users/ojieame/FieldPulse-v3 test:web-preview-entry
```

Current status: `GO`

### Gate 4: Moisture source integrity

- `GO` if:
  - active workspaces show `missingMoistureSnapshotCount: 0`
  - `seededMoistureCount: 0` or close to zero on customer-facing fields
  - `syntheticRasterCount: 0` or close to zero
  - `fieldsMissingBaselineDataset: 0`
- `NO-GO` if:
  - live fields still rely heavily on seeded or synthetic fallback

Commands:

```bash
corepack pnpm -C /Users/ojieame/FieldPulse-v3/apps/worker run sources:utilization -- --workspace-id <workspace-id> --json
```

Current status: `GO` for Dev Farm source integrity

### Gate 5: Field-level report readiness

- `GO` if:
  - the majority of launch-visible fields are `ready` for vegetation and moisture
  - empty/thin fields are either expected or hidden from demos/customers
- `NO-GO` if:
  - a large share of first-impression fields are `empty` or `thin`

Commands:

```bash
corepack pnpm -C /Users/ojieame/FieldPulse-v3/apps/worker run report:readiness -- --workspace-id <workspace-id> --json
```

Current status: `NO-GO`

Reason:

- Dev Farm is no longer broken or fallback-heavy, but most fields are still `thin`
- Hope Creek is good enough for a curated demo, not for uniform workspace-wide claims
- first-impression quality still depends heavily on which fields a new grower sees first

### Gate 6: Soil enrichment

- `GO` if:
  - a new field intake results in persisted soil properties
  - moisture rebuild uses those values
- `NO-GO` if:
  - intake still silently falls back to generic soil assumptions

Evidence path:

- worker registration in `/Users/ojieame/FieldPulse-v3/apps/worker/src/jobs/registry.ts`
- live DB verification after one real field intake

Current status: `UNVERIFIED`

### Gate 7: Historical context and anomaly path

- `GO` if:
  - recent moisture/weather history renders and anomaly-dependent claims are backed by data
- `NO-GO` if:
  - anomaly language is shipped while anomaly enrichment is still unfinished

Known gap:

- `/Users/ojieame/FieldPulse-v3/packages/modules/reports/src/application/buildFieldReportReadModel.ts` still documents anomaly fields as worker-populated and currently absent when not provided

Current status: `WARN`

Reason:

- historical anomaly claims are now more honest in the UI because incomplete anomaly context is hidden
- the underlying anomaly enrichment path is still not complete enough to power a durable “something changed in your field” alert loop

### Gate 8: Validation discipline

- `GO` if one of these is true:
  - real `SMAP` / `AppEEARS` validation is wired and run
  - or launch claims are explicitly limited to decision support, not authoritative field truth
- `NO-GO` if:
  - the product is marketed as validated truth while the backtest path still depends on CSV fixtures

Known gap:

- `/Users/ojieame/FieldPulse-v3/apps/worker/src/smapBacktest.ts` still requires `--smap-csv` until AppEEARS is wired

Current status: `WARN`

Reason:

- AppEEARS-backed SMAP validation is now wired and runnable
- the first legitimate scored sample is still weak:
  - `matchedDates: 3`
  - `RMSE: 6.41`
  - `MAE: 6.32`
  - `Pearson r: -0.895`
  - `bias: 6.32`
- this means the validation path exists, but the model still needs tuning before strong accuracy claims

### Gate 9: Auth, onboarding, and tenant isolation

- `GO` if:
  - new accounts land in fresh empty workspaces
  - no demo/shared field contamination remains
- `NO-GO` if:
  - new users still inherit seeded data

Current status: `ASSUMED GO`, requires one fresh end-to-end verification before launch day

### Gate 10: PDFs and reporting UX

- `GO` if:
  - both export routes return real PDFs
  - the documents open cleanly and contain expected data
- `NO-GO` if:
  - either route fails
  - crop export regresses to markdown/text

Current status: `UNVERIFIED in this pass`

## Minimum remaining work before calling this launch-ready

1. Clean the repo and release branch state.
2. Build and verify a guided sign-up-to-first-insight path for a real grower.
3. Decide which fields are allowed in launch demos and hide or defer `thin` readiness fields.
4. Finish or explicitly de-scope anomaly-dependent messaging and alert claims.
5. Improve moisture validation quality before using strong accuracy language.
6. Re-verify onboarding isolation and PDF exports on the live environment.

## Decision

Today, this repo is:

- `GO` for continued controlled beta work
- `NO-GO` for a broad launch claim without field curation and guided onboarding
- `NO-GO` for strong “authoritative agronomy” positioning until validation quality improves

The remaining problem is not missing backend architecture. The remaining problem is operational readiness at the field level.
