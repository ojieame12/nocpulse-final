# Platform DB

This package owns the database foundation for FieldPulse v3.

## Scope

- shared identifiers and audit contracts
- tenancy guardrails
- Supabase/Postgres schema migrations
- workspace-scoped RLS strategy

## Supabase layout

- `supabase/migrations` contains SQL migrations
- the initial schema uses the `app` schema for product tables
- PostGIS is assumed to be enabled in the `extensions` schema

## Rules

- business modules own their table contracts, not the web app
- the database package owns cross-cutting tenancy and audit primitives
- queries should target views/read models for dashboard-style reads
