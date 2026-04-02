alter table app.fields
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid;

create index if not exists fields_workspace_archived_name_idx
  on app.fields (workspace_id, archived_at, name);

drop view if exists app.field_overview;

create view app.field_overview
with (security_invoker = true)
as
select
  field_row.workspace_id,
  field_row.id,
  field_row.name,
  field_row.area_ha,
  field_row.legal_land_description,
  extensions.st_asgeojson(field_row.label_point)::jsonb as label_point_geojson,
  latest_snapshot.observed_at as latest_moisture_observed_at,
  latest_snapshot.root_zone_pct as latest_root_zone_pct,
  latest_snapshot.surface_pct as latest_surface_pct,
  latest_snapshot.confidence as latest_moisture_confidence,
  latest_snapshot.source_key as latest_moisture_source_key
from app.fields field_row
left join lateral (
  select
    snapshot.observed_at,
    snapshot.root_zone_pct,
    snapshot.surface_pct,
    snapshot.confidence,
    snapshot.source_key
  from app.field_moisture_snapshots snapshot
  where snapshot.workspace_id = field_row.workspace_id
    and snapshot.field_id = field_row.id
  order by snapshot.observed_at desc, snapshot.created_at desc
  limit 1
) latest_snapshot on true
where field_row.archived_at is null;

grant select on app.field_overview to authenticated, service_role;

drop function if exists app.get_field_detail(uuid, uuid);

create function app.get_field_detail(
  target_workspace_id uuid,
  target_field_id uuid
)
returns table (
  id uuid,
  workspace_id uuid,
  name text,
  area_ha numeric,
  legal_land_description text,
  boundary_geojson jsonb,
  label_point_geojson jsonb,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security invoker
set search_path = app, public, extensions
as $$
  select
    field_row.id,
    field_row.workspace_id,
    field_row.name,
    field_row.area_ha,
    field_row.legal_land_description,
    extensions.st_asgeojson(field_row.boundary)::jsonb as boundary_geojson,
    extensions.st_asgeojson(field_row.label_point)::jsonb as label_point_geojson,
    field_row.created_by,
    field_row.created_at,
    field_row.updated_at
  from app.fields field_row
  where field_row.workspace_id = target_workspace_id
    and field_row.id = target_field_id
    and field_row.archived_at is null;
$$;

grant execute on function app.get_field_detail(uuid, uuid) to authenticated, service_role;
