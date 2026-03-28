create table if not exists app.field_moisture_cell_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references app.workspaces (id) on delete cascade,
  field_id uuid not null references app.fields (id) on delete cascade,
  snapshot_id uuid not null references app.field_moisture_snapshots (id) on delete cascade,
  observed_at timestamptz not null,
  source_key text not null,
  cell_key text not null,
  row_index integer not null,
  column_index integer not null,
  centroid jsonb not null,
  boundary jsonb not null,
  root_zone_pct numeric(5, 2) not null,
  surface_pct numeric(5, 2) not null,
  confidence app.moisture_confidence not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint field_moisture_cell_snapshots_pct_range check (
    root_zone_pct between 0 and 100
    and surface_pct between 0 and 100
  ),
  constraint field_moisture_cell_snapshots_centroid_point check (
    jsonb_typeof(centroid) = 'object'
    and centroid ->> 'type' = 'Point'
  ),
  constraint field_moisture_cell_snapshots_boundary_polygon check (
    jsonb_typeof(boundary) = 'object'
    and boundary ->> 'type' = 'Polygon'
  ),
  constraint field_moisture_cell_snapshots_unique_cell unique (snapshot_id, cell_key)
);

create index if not exists field_moisture_cell_snapshots_lookup_idx
  on app.field_moisture_cell_snapshots (
    workspace_id,
    field_id,
    observed_at desc,
    created_at desc
  );

alter table app.field_moisture_cell_snapshots enable row level security;

create policy field_moisture_cell_snapshots_select_member
  on app.field_moisture_cell_snapshots
  for select
  to authenticated
  using (
    auth.uid() is not null
    and app.is_workspace_member(workspace_id)
  );

create policy field_moisture_cell_snapshots_insert_manager
  on app.field_moisture_cell_snapshots
  for insert
  to authenticated
  with check (
    auth.uid() is not null
    and app.can_manage_workspace(workspace_id)
  );

create policy field_moisture_cell_snapshots_update_manager
  on app.field_moisture_cell_snapshots
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

create policy field_moisture_cell_snapshots_delete_manager
  on app.field_moisture_cell_snapshots
  for delete
  to authenticated
  using (
    auth.uid() is not null
    and app.can_manage_workspace(workspace_id)
  );

grant select, insert, update, delete on app.field_moisture_cell_snapshots to authenticated, service_role;
