# FieldPulse v3

Fresh-slate repository for the v3 rebuild.

## Bootstrap

This repo is scaffolded for `pnpm` workspaces. `pnpm` is not installed on this
machine yet, so install it before running the workspace:

```bash
corepack enable
corepack prepare pnpm@10.0.0 --activate
pnpm install
```

## Verification

- `pnpm lint` runs the architecture boundary checker.
- `pnpm typecheck` verifies all workspace packages plus the web and worker apps.
- `pnpm build` runs boundary checks, typechecks the workspace, builds the web app, and bundles the worker.
- `pnpm bootstrap:dev-data` seeds one workspace, one field, and one moisture snapshot into the linked Supabase project for local development.

## Worker operations

- `pnpm --filter @fieldpulse/worker start` runs the persistent worker loop.
- `pnpm --filter @fieldpulse/worker boot` prints the current worker/runtime wiring without starting the loop.
- `pnpm --filter @fieldpulse/worker enqueue -- --key ops.long-running-smoke --sample` queues a sample job without running it immediately.
- `pnpm --filter @fieldpulse/worker drain -- --key imagery.schedule-workspace-provider-probes,imagery.record-provider-probe --limit 20` drains only matching queued jobs, which is useful for scheduled probe sweeps without stepping into unrelated worker traffic.
- `pnpm --filter @fieldpulse/worker inspect -- --status failed --limit 10` lists recent queue dispatches.
- `pnpm --filter @fieldpulse/worker health` prints a database-backed queue health snapshot, including stale-running and cancellation-request counts.
- `pnpm --filter @fieldpulse/worker imagery:providers -- --json` reports live imagery provider diagnostics, including whether discovery/materialization are provider-backed or falling back to synthetic paths.
- `pnpm --filter @fieldpulse/worker imagery:probe-schedule -- --workspace-id <workspace-id> --limit 10` queues workspace probe-sweep jobs that fan out into persisted field probe jobs during worker execution.
- `pnpm --filter @fieldpulse/worker imagery:probe-report -- --since-hours 6` summarizes only recent fallback probe records, grouped by provider with latest affected fields.
- `pnpm --filter @fieldpulse/worker hail:cadence -- --workspace-id <workspace-id> --limit 10 --drain-limit 50 --stale-after-hours 24` queues hail workspace refresh jobs, drains only hail cadence keys, and prints a recent hail refresh summary.
- `pnpm --filter @fieldpulse/worker hail:report -- --workspace-id <workspace-id> --stale-after-hours 24` summarizes recent hail refresh coverage, matched fields, no-signal fields, and stale refresh gaps.
- `pnpm --filter @fieldpulse/worker hail:refresh-schedule -- --workspace-id <workspace-id> --limit 10` queues workspace hail refresh jobs that fan out into persisted field hail refreshes during worker execution.
- `pnpm --filter @fieldpulse/worker weather:refresh-schedule -- --workspace-id <workspace-id> --limit 10 --forecast-hours 48` queues workspace weather refresh jobs that fan out into persisted field weather refreshes during worker execution.
- `pnpm --filter @fieldpulse/worker metrics` emits a Prometheus-style metrics snapshot built from queue health plus aggregated dispatch, phase, and attempt timing summaries.
- `pnpm --filter @fieldpulse/worker start` now exposes HTTP scrape endpoints from the worker runtime: `/metrics`, `/metrics.json`, `/healthz`, and `/readyz`.
- `pnpm --filter @fieldpulse/worker attempts -- --id <dispatch-id>` lists per-attempt timelines and phase-count aggregates for one dispatch or filtered job set.
- `pnpm --filter @fieldpulse/worker cancel -- --id <dispatch-id> --reason "operator requested stop"` requests cancellation for a queued or running dispatch.
- `pnpm --filter @fieldpulse/worker phase-summary -- --key ops.long-running-smoke` aggregates phase timing by job key and phase key across historical runs.
- `pnpm --filter @fieldpulse/worker recover:stale -- --limit 20` settles stale running dispatches through the queue adapter. Rows with pending cancellation requests are cancelled by default; pass `--force-requeue` to requeue them instead.
- `pnpm --filter @fieldpulse/worker phases -- --id <dispatch-id>` lists persisted phase-run history for one dispatch and optional attempt.
- `pnpm --filter @fieldpulse/worker watch -- --id <dispatch-id> --interval-ms 1000` watches live progress for one dispatch and stops when it settles. Add `--keep-watching` to continue polling after settlement.
- `pnpm --filter @fieldpulse/worker summary -- --status failed --limit 200` reads database-backed dispatch summaries grouped by job key and status.
- `pnpm --filter @fieldpulse/worker replay -- --id <dispatch-id>` replays a completed or failed dispatch as a fresh queued job.
- `pnpm --filter @fieldpulse/worker replay:failed -- --limit 10 --execute` replays a batch of failed dispatches as fresh queued jobs.
- `inspect` and `watch` now surface attempt timing and live phase state: `attemptStartedAt`, `lastHeartbeatAt`, `activePhaseKey`, `activePhaseLabel`, and `lastAttemptDurationMs`.
- Phase-run history is persisted separately, so you can inspect completed/cancelled/interrupted phases after the dispatch has settled.
- Optional runtime env for the scrape server: `WORKER_METRICS_ENABLED`, `WORKER_METRICS_HOST`, `WORKER_METRICS_PORT`, `WORKER_METRICS_LIMIT`.

## Cron logging

- `./scripts/run-cadence.sh market` runs the market cadence and writes a timestamped log to `logs/cadence/market/`.
- `./scripts/run-cadence.sh probe` runs the probe schedule, drains only the probe queue keys, then writes the probe report to `logs/cadence/probe/`.
- `./scripts/run-cadence.sh hail` runs the hail cadence for `FIELDPULSE_WORKSPACE_ID` and writes output to `logs/cadence/hail/`.
- `./scripts/run-cadence.sh action-brief` runs the material-change action-brief cadence, queues weather + action-brief jobs, and writes output to `logs/cadence/action-brief/`.
- Each job also updates a `latest.log` symlink in its log directory so you can quickly inspect the newest run.
- [`scripts/cadence.crontab.example`](/Users/ojieame/FieldPulse-v3/scripts/cadence.crontab.example) is a starter crontab with the cadence jobs staggered every 6 hours.
- On macOS, if `crontab` is blocked, run `./scripts/install-cadence-launchd.sh` to install equivalent `launchd` agents from [`scripts/launchd/`](/Users/ojieame/FieldPulse-v3/scripts/launchd).

## Layout

- `apps/web` - Next.js web application
- `apps/worker` - Node + Python worker runtime
- `packages/modules` - business modules
- `packages/map` - map runtime and rendering contracts
- `packages/raster` - raster and GeoTIFF processing
- `packages/pdf` - PDF generation
- `packages/platform` - shared platform packages

## Principles

- One product, one app shell
- No bridge routes
- No direct database access from React
- No raw map engine access outside the map package
- No long-running work in request paths
- No product-critical silent error swallowing
- No giant monolith files without an explicit exception

## Architecture docs

- `docs/architecture/modular-monolith.md`
- `docs/architecture/rendering-contract.md`
- `docs/architecture/data-foundation.md`
- `docs/ui-source-of-truth.md`

## Enforcement

- Shared packages are typechecked through `tsconfig.packages.json`.
- `apps/web` and `apps/worker` are typechecked independently.
- `scripts/check-boundaries.mjs` rejects cross-package source imports and forbidden layer imports.
- The worker build bundles internal `@fieldpulse/*` packages so production runtime does not depend on unresolved workspace source paths.

## Environment

- The repo assumes Supabase signing keys and API keys; it does not require a legacy `SUPABASE_JWT_SECRET`.
- The config layer accepts `R2_ACCOUNT_ID` or `CLOUDFLARE_ACCOUNT_ID`.
- The config layer accepts `R2_BUCKET` or `R2_BUCKET_NAME`.
- `DATABASE_URL` is optional for future direct SQL/ORM tooling.
- Live Supabase repository wiring now lives in `@fieldpulse/platform-runtime`, not inside the app folders.
- Authenticated diagnostics are also available over the web route `GET /api/imagery/providers`.
