create table if not exists app.field_intelligence_zones (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  field_id uuid not null,
  family text not null,
  tracking_key text not null,
  latest_finding_id uuid references app.field_intelligence_findings(id) on delete set null,
  latest_run_id uuid references app.field_intelligence_runs(id) on delete set null,
  status text not null,
  latest_severity text,
  zone_geojson jsonb not null,
  affected_cell_keys text[] not null default '{}',
  detection_count integer not null default 1,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  last_status_changed_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint field_intelligence_zones_field_fk
    foreign key (workspace_id, field_id)
    references app.fields(workspace_id, id)
    on delete cascade,
  constraint field_intelligence_zones_family check (
    family in (
      'hail_risk',
      'weather_risk',
      'moisture_stress',
      'crop_health',
      'disease_risk',
      'action_brief'
    )
  ),
  constraint field_intelligence_zones_status check (
    status in ('new', 'persistent', 'recovering', 'resolved')
  ),
  constraint field_intelligence_zones_latest_severity check (
    latest_severity is null or latest_severity in ('low', 'medium', 'high', 'critical')
  ),
  constraint field_intelligence_zones_zone_object check (
    jsonb_typeof(zone_geojson) = 'object'
  ),
  constraint field_intelligence_zones_detection_count check (
    detection_count >= 0
  ),
  constraint field_intelligence_zones_metadata_object check (
    jsonb_typeof(metadata) = 'object'
  )
);

create index if not exists field_intelligence_zones_field_lookup_idx
  on app.field_intelligence_zones (
    workspace_id,
    field_id,
    family,
    tracking_key,
    status,
    last_seen_at desc,
    updated_at desc
  );

create trigger field_intelligence_zones_set_updated_at
before update on app.field_intelligence_zones
for each row
execute function app.set_updated_at();

alter table app.field_intelligence_zones enable row level security;

create policy field_intelligence_zones_select_member
  on app.field_intelligence_zones
  for select
  to authenticated
  using (
    auth.uid() is not null
    and app.is_workspace_member(workspace_id)
  );

create policy field_intelligence_zones_insert_manager
  on app.field_intelligence_zones
  for insert
  to authenticated
  with check (
    auth.uid() is not null
    and app.can_manage_workspace(workspace_id)
  );

create policy field_intelligence_zones_update_manager
  on app.field_intelligence_zones
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

create policy field_intelligence_zones_delete_manager
  on app.field_intelligence_zones
  for delete
  to authenticated
  using (
    auth.uid() is not null
    and app.can_manage_workspace(workspace_id)
  );
