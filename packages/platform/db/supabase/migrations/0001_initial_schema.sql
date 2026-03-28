create extension if not exists pgcrypto with schema extensions;
create extension if not exists postgis with schema extensions;

create schema if not exists app;

grant usage on schema app to authenticated, service_role;

do $$
begin
  if not exists (
    select 1
    from pg_type type_def
    join pg_namespace namespace_def on namespace_def.oid = type_def.typnamespace
    where namespace_def.nspname = 'app'
      and type_def.typname = 'workspace_role'
  ) then
    create type app.workspace_role as enum ('owner', 'manager', 'member', 'viewer');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type type_def
    join pg_namespace namespace_def on namespace_def.oid = type_def.typnamespace
    where namespace_def.nspname = 'app'
      and type_def.typname = 'moisture_confidence'
  ) then
    create type app.moisture_confidence as enum ('low', 'medium', 'high');
  end if;
end
$$;

create or replace function app.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists app.workspaces (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_by uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint workspaces_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table if not exists app.workspace_memberships (
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  user_id uuid not null,
  role app.workspace_role not null,
  invited_by uuid,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (workspace_id, user_id)
);

create table if not exists app.fields (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  name text not null,
  area_ha numeric(12, 2) not null,
  boundary extensions.geometry(MultiPolygon, 4326) not null,
  label_point extensions.geometry(Point, 4326) generated always as (
    extensions.st_pointonsurface(boundary)
  ) stored,
  created_by uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint fields_area_positive check (area_ha > 0),
  constraint fields_workspace_id_id_unique unique (workspace_id, id)
);

create table if not exists app.field_moisture_snapshots (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  field_id uuid not null,
  observed_at timestamptz not null,
  source_key text not null,
  root_zone_pct numeric(5, 2) not null,
  surface_pct numeric(5, 2) not null,
  confidence app.moisture_confidence not null,
  inputs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint field_moisture_snapshots_field_fk
    foreign key (workspace_id, field_id)
    references app.fields(workspace_id, id)
    on delete cascade,
  constraint field_moisture_snapshots_pct_range check (
    root_zone_pct >= 0
    and root_zone_pct <= 100
    and surface_pct >= 0
    and surface_pct <= 100
  ),
  constraint field_moisture_snapshots_inputs_object check (
    jsonb_typeof(inputs) = 'object'
  ),
  constraint field_moisture_snapshots_unique_source unique (
    field_id,
    observed_at,
    source_key
  )
);

create index if not exists workspaces_created_by_idx
  on app.workspaces (created_by);

create index if not exists workspace_memberships_user_idx
  on app.workspace_memberships (user_id, workspace_id);

create index if not exists fields_workspace_name_idx
  on app.fields (workspace_id, name);

create index if not exists fields_boundary_gix
  on app.fields using gist (boundary);

create index if not exists fields_label_point_gix
  on app.fields using gist (label_point);

create index if not exists field_moisture_snapshots_lookup_idx
  on app.field_moisture_snapshots (workspace_id, field_id, observed_at desc, created_at desc);

create trigger workspaces_set_updated_at
before update on app.workspaces
for each row
execute function app.set_updated_at();

create trigger fields_set_updated_at
before update on app.fields
for each row
execute function app.set_updated_at();

create or replace function app.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public
as $$
  select exists (
    select 1
    from app.workspace_memberships membership
    where membership.workspace_id = target_workspace_id
      and membership.user_id = auth.uid()
  );
$$;

create or replace function app.can_manage_workspace(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public
as $$
  select exists (
    select 1
    from app.workspace_memberships membership
    where membership.workspace_id = target_workspace_id
      and membership.user_id = auth.uid()
      and membership.role in ('owner', 'manager')
  );
$$;

revoke all on function app.is_workspace_member(uuid) from public;
revoke all on function app.can_manage_workspace(uuid) from public;
grant execute on function app.is_workspace_member(uuid) to authenticated, service_role;
grant execute on function app.can_manage_workspace(uuid) to authenticated, service_role;

alter table app.workspaces enable row level security;
alter table app.workspace_memberships enable row level security;
alter table app.fields enable row level security;
alter table app.field_moisture_snapshots enable row level security;

create policy workspaces_select_member
  on app.workspaces
  for select
  to authenticated
  using (
    auth.uid() is not null
    and (app.is_workspace_member(id) or created_by = auth.uid())
  );

create policy workspaces_insert_creator
  on app.workspaces
  for insert
  to authenticated
  with check (
    auth.uid() is not null
    and created_by = auth.uid()
  );

create policy workspaces_update_manager
  on app.workspaces
  for update
  to authenticated
  using (
    auth.uid() is not null
    and app.can_manage_workspace(id)
  )
  with check (
    auth.uid() is not null
    and app.can_manage_workspace(id)
  );

create policy workspaces_delete_owner
  on app.workspaces
  for delete
  to authenticated
  using (
    auth.uid() is not null
    and exists (
      select 1
      from app.workspace_memberships membership
      where membership.workspace_id = id
        and membership.user_id = auth.uid()
        and membership.role = 'owner'
    )
  );

create policy workspace_memberships_select_member
  on app.workspace_memberships
  for select
  to authenticated
  using (
    auth.uid() is not null
    and (app.is_workspace_member(workspace_id) or user_id = auth.uid())
  );

create policy workspace_memberships_insert_manager_or_creator
  on app.workspace_memberships
  for insert
  to authenticated
  with check (
    auth.uid() is not null
    and (
      app.can_manage_workspace(workspace_id)
      or (
        role = 'owner'
        and user_id = auth.uid()
        and exists (
          select 1
          from app.workspaces workspace_row
          where workspace_row.id = workspace_id
            and workspace_row.created_by = auth.uid()
        )
      )
    )
  );

create policy workspace_memberships_update_manager
  on app.workspace_memberships
  for update
  to authenticated
  using (
    auth.uid() is not null
    and app.can_manage_workspace(workspace_id)
  )
  with check (
    auth.uid() is not null
    and app.can_manage_workspace(workspace_id)
  );

create policy workspace_memberships_delete_manager
  on app.workspace_memberships
  for delete
  to authenticated
  using (
    auth.uid() is not null
    and app.can_manage_workspace(workspace_id)
  );

create policy fields_select_member
  on app.fields
  for select
  to authenticated
  using (
    auth.uid() is not null
    and app.is_workspace_member(workspace_id)
  );

create policy fields_insert_manager
  on app.fields
  for insert
  to authenticated
  with check (
    auth.uid() is not null
    and created_by = auth.uid()
    and app.can_manage_workspace(workspace_id)
  );

create policy fields_update_manager
  on app.fields
  for update
  to authenticated
  using (
    auth.uid() is not null
    and app.can_manage_workspace(workspace_id)
  )
  with check (
    auth.uid() is not null
    and app.can_manage_workspace(workspace_id)
  );

create policy fields_delete_manager
  on app.fields
  for delete
  to authenticated
  using (
    auth.uid() is not null
    and app.can_manage_workspace(workspace_id)
  );

create policy field_moisture_snapshots_select_member
  on app.field_moisture_snapshots
  for select
  to authenticated
  using (
    auth.uid() is not null
    and app.is_workspace_member(workspace_id)
  );

create policy field_moisture_snapshots_insert_manager
  on app.field_moisture_snapshots
  for insert
  to authenticated
  with check (
    auth.uid() is not null
    and app.can_manage_workspace(workspace_id)
  );

create policy field_moisture_snapshots_update_manager
  on app.field_moisture_snapshots
  for update
  to authenticated
  using (
    auth.uid() is not null
    and app.can_manage_workspace(workspace_id)
  )
  with check (
    auth.uid() is not null
    and app.can_manage_workspace(workspace_id)
  );

create policy field_moisture_snapshots_delete_manager
  on app.field_moisture_snapshots
  for delete
  to authenticated
  using (
    auth.uid() is not null
    and app.can_manage_workspace(workspace_id)
  );

grant select, insert, update, delete on all tables in schema app to authenticated, service_role;
grant usage, select on all sequences in schema app to authenticated, service_role;

alter default privileges in schema app
grant select, insert, update, delete on tables to authenticated, service_role;

alter default privileges in schema app
grant usage, select on sequences to authenticated, service_role;

create or replace view app.field_overview
with (security_invoker = true)
as
select
  field_row.workspace_id,
  field_row.id,
  field_row.name,
  field_row.area_ha,
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
