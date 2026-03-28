# Supabase Runtime

FieldPulse v3 uses modern Supabase project credentials:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

The scaffold does **not** assume a legacy shared `SUPABASE_JWT_SECRET`.

## Why

- Supabase projects now use signing keys for JWT verification.
- The current web app does not perform local JWT verification.
- The worker uses service-role access for server-side repository wiring.

## Current runtime boundary

- `@fieldpulse/platform-config` normalizes the environment
- `@fieldpulse/platform-runtime` builds the live Supabase-backed repositories
- `apps/web` and `apps/worker` consume the runtime package instead of creating database clients directly

## Optional direct SQL access

`DATABASE_URL` is supported for future direct Postgres tooling, but it is not required for the current Supabase-backed repository flow.
