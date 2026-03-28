create extension if not exists postgis;

create table if not exists app.field_raster_observations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  field_id uuid not null references app.fields(id) on delete cascade,
  observed_at timestamptz not null,
  source_key text not null,
  provider_key text not null,
  artifact_key text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists field_raster_observations_workspace_field_observed_idx
  on app.field_raster_observations (workspace_id, field_id, observed_at desc);

create unique index if not exists field_raster_observations_workspace_field_source_observed_uidx
  on app.field_raster_observations (workspace_id, field_id, source_key, observed_at);

create table if not exists app.field_raster_observation_cells (
  id uuid primary key default gen_random_uuid(),
  observation_id uuid not null references app.field_raster_observations(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  field_id uuid not null references app.fields(id) on delete cascade,
  observed_at timestamptz not null,
  source_key text not null,
  provider_key text not null,
  cell_key text not null,
  row_index integer not null,
  column_index integer not null,
  centroid extensions.geometry(Point, 4326) not null,
  boundary extensions.geometry(Polygon, 4326) not null,
  measurements jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists field_raster_observation_cells_workspace_field_observed_idx
  on app.field_raster_observation_cells (workspace_id, field_id, observed_at desc);

create unique index if not exists field_raster_observation_cells_observation_cell_uidx
  on app.field_raster_observation_cells (observation_id, cell_key);

alter table app.field_raster_observations enable row level security;
alter table app.field_raster_observation_cells enable row level security;

create policy "field raster observations select by workspace member"
on app.field_raster_observations
for select
using (
  exists (
    select 1
    from app.workspace_memberships memberships
    where memberships.workspace_id = field_raster_observations.workspace_id
      and memberships.user_id = auth.uid()
  )
);

create policy "field raster observations mutate by workspace manager"
on app.field_raster_observations
for all
using (
  exists (
    select 1
    from app.workspace_memberships memberships
    where memberships.workspace_id = field_raster_observations.workspace_id
      and memberships.user_id = auth.uid()
      and memberships.role in ('owner', 'manager')
  )
)
with check (
  exists (
    select 1
    from app.workspace_memberships memberships
    where memberships.workspace_id = field_raster_observations.workspace_id
      and memberships.user_id = auth.uid()
      and memberships.role in ('owner', 'manager')
  )
);

create policy "field raster observation cells select by workspace member"
on app.field_raster_observation_cells
for select
using (
  exists (
    select 1
    from app.workspace_memberships memberships
    where memberships.workspace_id = field_raster_observation_cells.workspace_id
      and memberships.user_id = auth.uid()
  )
);

create policy "field raster observation cells mutate by workspace manager"
on app.field_raster_observation_cells
for all
using (
  exists (
    select 1
    from app.workspace_memberships memberships
    where memberships.workspace_id = field_raster_observation_cells.workspace_id
      and memberships.user_id = auth.uid()
      and memberships.role in ('owner', 'manager')
  )
)
with check (
  exists (
    select 1
    from app.workspace_memberships memberships
    where memberships.workspace_id = field_raster_observation_cells.workspace_id
      and memberships.user_id = auth.uid()
      and memberships.role in ('owner', 'manager')
  )
);
