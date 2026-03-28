create table if not exists app.field_hail_events (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  field_id uuid not null,
  provider_key text not null,
  source_key text not null,
  source_event_key text not null,
  dedupe_key text not null,
  event_type text not null,
  severity text not null,
  reported_at timestamptz not null,
  window_start timestamptz,
  window_end timestamptz,
  headline text not null,
  summary text,
  hail_size_mm numeric(8, 2),
  coverage_geojson jsonb,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint field_hail_events_field_fk
    foreign key (workspace_id, field_id)
    references app.fields(workspace_id, id)
    on delete cascade,
  constraint field_hail_events_unique_dedupe unique (field_id, dedupe_key),
  constraint field_hail_events_event_type check (
    event_type in ('warning', 'observed')
  ),
  constraint field_hail_events_severity check (
    severity in ('advisory', 'watch', 'warning', 'severe')
  ),
  constraint field_hail_events_nonnegative_hail_size check (
    hail_size_mm is null or hail_size_mm >= 0
  ),
  constraint field_hail_events_geojson_object check (
    coverage_geojson is null or jsonb_typeof(coverage_geojson) = 'object'
  ),
  constraint field_hail_events_provenance_object check (
    jsonb_typeof(provenance) = 'object'
  )
);

create index if not exists field_hail_events_field_lookup_idx
  on app.field_hail_events (workspace_id, field_id, reported_at desc, updated_at desc);

create index if not exists field_hail_events_workspace_recent_idx
  on app.field_hail_events (workspace_id, reported_at desc, updated_at desc);

create trigger field_hail_events_set_updated_at
before update on app.field_hail_events
for each row
execute function app.set_updated_at();

alter table app.field_hail_events enable row level security;

create policy field_hail_events_select_member
  on app.field_hail_events
  for select
  to authenticated
  using (
    auth.uid() is not null
    and app.is_workspace_member(workspace_id)
  );

create policy field_hail_events_insert_manager
  on app.field_hail_events
  for insert
  to authenticated
  with check (
    auth.uid() is not null
    and app.can_manage_workspace(workspace_id)
  );

create policy field_hail_events_update_manager
  on app.field_hail_events
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

create policy field_hail_events_delete_manager
  on app.field_hail_events
  for delete
  to authenticated
  using (
    auth.uid() is not null
    and app.can_manage_workspace(workspace_id)
  );
