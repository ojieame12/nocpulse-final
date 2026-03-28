# Data Foundation

FieldPulse v3 starts with a workspace-scoped Postgres model and pushes spatial work
into PostGIS instead of application code.

## Initial owned tables

- `app.workspaces`
- `app.workspace_memberships`
- `app.fields`
- `app.field_moisture_snapshots`

## Initial read model

- `app.field_overview`

This view gives the web app a stable dashboard-style read surface without forcing
the application layer to hand-maintain denormalized columns on every write.

## Tenancy

- every core record carries `workspace_id`
- memberships determine read access
- manager and owner roles determine write access
- service-role worker paths may bypass RLS, but application-facing access remains workspace-scoped

## Geospatial decisions

- field boundaries are stored as `extensions.geometry(MultiPolygon, 4326)`
- label points are generated in the database with `st_pointonsurface`
- spatial indexes live beside the field boundary itself

## Why this matters

- `fields` owns field geometry contracts
- `moisture` owns moisture snapshots and provenance contracts
- `workspaces` owns tenancy and role contracts
- `platform/db` owns shared ids, audit primitives, and the migration/RLS foundation
