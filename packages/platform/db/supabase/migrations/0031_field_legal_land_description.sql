alter table app.fields
  add column if not exists legal_land_description text;

update app.fields as field_row
set legal_land_description = candidate.latest_lld
from (
  select distinct on (candidate_row.workspace_id, candidate_row.committed_field_id)
    candidate_row.workspace_id,
    candidate_row.committed_field_id,
    nullif(array_to_string(array(
      select jsonb_array_elements_text(candidate_row.legal_land_descriptions)
    ), ', '), '') as latest_lld
  from app.field_import_candidates candidate_row
  where candidate_row.status = 'committed'
    and candidate_row.committed_field_id is not null
  order by
    candidate_row.workspace_id,
    candidate_row.committed_field_id,
    candidate_row.committed_at desc nulls last,
    candidate_row.updated_at desc
) as candidate
where field_row.workspace_id = candidate.workspace_id
  and field_row.id = candidate.committed_field_id
  and candidate.latest_lld is not null
  and (
    field_row.legal_land_description is null
    or field_row.legal_land_description = ''
  );

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
) latest_snapshot on true;

grant select on app.field_overview to authenticated, service_role;

drop function if exists app.create_field_record(uuid, text, numeric, jsonb, uuid);

create function app.create_field_record(
  target_workspace_id uuid,
  field_name text,
  field_area_ha numeric,
  field_boundary_geojson jsonb,
  actor_user_id uuid
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
language plpgsql
security invoker
set search_path = app, public, extensions
as $$
declare
  inserted_field app.fields;
begin
  insert into app.fields (
    workspace_id,
    name,
    area_ha,
    boundary,
    created_by
  )
  values (
    target_workspace_id,
    field_name,
    field_area_ha,
    extensions.st_setsrid(
      extensions.st_geomfromgeojson(field_boundary_geojson::text),
      4326
    )::extensions.geometry(MultiPolygon, 4326),
    actor_user_id
  )
  returning * into inserted_field;

  return query
  select
    inserted_field.id,
    inserted_field.workspace_id,
    inserted_field.name,
    inserted_field.area_ha,
    inserted_field.legal_land_description,
    extensions.st_asgeojson(inserted_field.boundary)::jsonb as boundary_geojson,
    extensions.st_asgeojson(inserted_field.label_point)::jsonb as label_point_geojson,
    inserted_field.created_by,
    inserted_field.created_at,
    inserted_field.updated_at;
end;
$$;

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
    and field_row.id = target_field_id;
$$;

grant execute on function app.create_field_record(uuid, text, numeric, jsonb, uuid) to authenticated, service_role;
grant execute on function app.get_field_detail(uuid, uuid) to authenticated, service_role;
