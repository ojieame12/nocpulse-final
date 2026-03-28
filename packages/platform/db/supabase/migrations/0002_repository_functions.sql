create or replace function app.create_workspace_with_owner_membership(
  workspace_name text,
  workspace_slug text,
  actor_user_id uuid
)
returns app.workspaces
language plpgsql
security invoker
set search_path = app, public, extensions
as $$
declare
  inserted_workspace app.workspaces;
begin
  insert into app.workspaces (name, slug, created_by)
  values (workspace_name, workspace_slug, actor_user_id)
  returning * into inserted_workspace;

  insert into app.workspace_memberships (
    workspace_id,
    user_id,
    role,
    invited_by
  )
  values (
    inserted_workspace.id,
    actor_user_id,
    'owner',
    actor_user_id
  )
  on conflict (workspace_id, user_id) do nothing;

  return inserted_workspace;
end;
$$;

create or replace function app.create_field_record(
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
    extensions.st_asgeojson(inserted_field.boundary)::jsonb as boundary_geojson,
    extensions.st_asgeojson(inserted_field.label_point)::jsonb as label_point_geojson,
    inserted_field.created_by,
    inserted_field.created_at,
    inserted_field.updated_at;
end;
$$;

create or replace function app.get_field_detail(
  target_workspace_id uuid,
  target_field_id uuid
)
returns table (
  id uuid,
  workspace_id uuid,
  name text,
  area_ha numeric,
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
    extensions.st_asgeojson(field_row.boundary)::jsonb as boundary_geojson,
    extensions.st_asgeojson(field_row.label_point)::jsonb as label_point_geojson,
    field_row.created_by,
    field_row.created_at,
    field_row.updated_at
  from app.fields field_row
  where field_row.workspace_id = target_workspace_id
    and field_row.id = target_field_id;
$$;

grant execute on function app.create_workspace_with_owner_membership(text, text, uuid) to authenticated, service_role;
grant execute on function app.create_field_record(uuid, text, numeric, jsonb, uuid) to authenticated, service_role;
grant execute on function app.get_field_detail(uuid, uuid) to authenticated, service_role;
