# Controlled Beta Runbook

Use this runbook to decide whether `/Users/ojieame/FieldPulse-v3` is ready for a managed beta widening without changing the product surface.

## 1. Check release hygiene

```bash
git -C /Users/ojieame/FieldPulse-v3 status --short --branch
git -C /Users/ojieame/FieldPulse-v3 rev-parse --short HEAD
```

Expected:
- branch is intentional
- working tree is clean

## 2. Run the beta-readiness report

Workspace-specific:

```bash
corepack pnpm -C /Users/ojieame/FieldPulse-v3/apps/worker run report:beta-readiness -- --workspace-slug hope-creek --json
```

Portfolio-wide:

```bash
corepack pnpm -C /Users/ojieame/FieldPulse-v3/apps/worker run report:beta-readiness -- --days 30 --limit 200 --json
```

What it checks:
- queue health
- action-brief cadence activity
- source integrity from the latest field context
- field quality
- first-insight evidence

Interpretation:
- `GO`: acceptable for managed beta widening
- `WARN`: ship only with explicit curation/support awareness
- `NO-GO`: fix before expanding access

## 3. Spot-check queue health directly

```bash
corepack pnpm -C /Users/ojieame/FieldPulse-v3/apps/worker run health -- --json
corepack pnpm -C /Users/ojieame/FieldPulse-v3/apps/worker run summary -- --limit 50
```

Escalate if:
- `staleRunningCount > 0`
- queue backlog is growing instead of draining
- `intelligence.generate-action-brief` has no completed history

## 4. Spot-check field quality on launch-visible workspaces

```bash
corepack pnpm -C /Users/ojieame/FieldPulse-v3/apps/worker run report:quality -- --workspace-slug hope-creek --json
corepack pnpm -C /Users/ojieame/FieldPulse-v3/apps/worker run report:quality -- --workspace-id a625a72d-a2de-43ee-8bb4-aad93466f750 --json
corepack pnpm -C /Users/ojieame/FieldPulse-v3 ops:launch-visible -- --workspace-slug hope-creek --json
```

Look for:
- enough `ready` fields to support first impressions
- low `fallback` / `broken` counts
- long-tail cleanup still needed on `thin` fields
- at least two `ready` allowlisted fields on curated workspaces before widening beta

## 5. Verify first-insight evidence

```bash
corepack pnpm -C /Users/ojieame/FieldPulse-v3/apps/worker run report:first-insight -- --workspace-slug hope-creek --json
corepack pnpm -C /Users/ojieame/FieldPulse-v3/apps/worker run report:first-insight-funnel -- --days 30 --json
corepack pnpm -C /Users/ojieame/FieldPulse-v3 ops:first-insight-followup -- --days 30 --json
```

Use this to confirm:
- real users are reaching first insight
- the focus fields are the intended launch-visible ones
- comparison depth is high enough to support the surface
- granted workspaces without first insight have a concrete next action instead of sitting in limbo

## 6. Only widen beta when these are true

- repo/deploy state is clean
- queue has no stale work
- action-brief cadence is completing
- launch-visible fields are mostly `ready`
- weak-field claims are being held back
- at least one real grower walkthrough has completed without a dead-end

## 7. If the report comes back `WARN` or `NO-GO`

Priority order:
1. fix first-insight dead-ends
2. clear queue / cadence issues
3. tighten field curation
4. clean up long-tail field quality

Do not add new product surface before those are stable.
