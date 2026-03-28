# Modular Monolith Rules

FieldPulse v3 is a modular monolith. It is intentionally **not** a folder-based
monolith and **not** a microservice rewrite.

## Runtime split

- `apps/web` owns request/response and UI composition.
- `apps/worker` owns ingestion, raster processing, moisture, alerts, and reports.
- `packages/modules/*` own business capabilities.
- `packages/platform/*` own reusable technical concerns.
- `packages/map` owns rendering contracts and map runtime wiring.
- `packages/raster` owns GeoTIFF, PNG, and raster transforms.
- `packages/pdf` owns report rendering.

## Layer split inside a module

Each business module should use these layers:

- `contracts`
- `domain`
- `application`
- `infrastructure`

### Allowed dependency flow

- `contracts` -> platform contracts only
- `domain` -> `contracts`, platform contracts, pure utilities
- `application` -> `domain`, `contracts`
- `infrastructure` -> `application`, `domain`, `contracts`, platform packages

### Forbidden dependency flow

- `domain` -> `application`
- `domain` -> `infrastructure`
- `contracts` -> `application`
- `contracts` -> `infrastructure`
- `application` -> `infrastructure`
- any package -> app implementation files
- any app -> another app via relative import

## Public API rule

Every package exports a public API through `src/index.ts`.

Consumers must import package names such as:

- `@fieldpulse/module-fields`
- `@fieldpulse/platform-config`
- `@fieldpulse/map`

Consumers must not import internal source paths like:

- `@fieldpulse/module-fields/src/application/...`
- `../../packages/map/src/...`

## Enforcement rules

- `scripts/check-boundaries.mjs` is a hard gate in `pnpm lint`.
- `tsconfig.packages.json` typechecks every file under `packages/`.
- The worker bundles internal workspace packages into its artifact so jobs do not rely on ad hoc runtime loading of package source.
- Large files need an explicit exception. The default expectation is to decompose before a file reaches 500 lines.

## Tenancy rule

Every core business record is scoped by `workspace_id`.

Single-user launch is an authorization policy, not a schema shortcut.
