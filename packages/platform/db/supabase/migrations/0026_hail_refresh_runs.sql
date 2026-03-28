create table if not exists app.field_hail_refresh_runs (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  field_id uuid not null,
  provider_key text not null,
  source_key text not null,
  requested_at timestamptz not null,
  completed_at timestamptz,
  status text not null,
  matched_event_count integer not null default 0,
  latest_matched_reported_at timestamptz,
  error_message text,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint field_hail_refresh_runs_field_fk
    foreign key (workspace_id, field_id)
    references app.fields(workspace_id, id)
    on delete cascade,
  constraint field_hail_refresh_runs_unique_source unique (
    field_id,
    source_key,
    requested_at
  ),
  constraint field_hail_refresh_runs_status check (
    status in ('completed', 'failed')
  ),
  constraint field_hail_refresh_runs_nonnegative_matched_event_count check (
    matched_event_count >= 0
  ),
  constraint field_hail_refresh_runs_provenance_object check (
    jsonb_typeof(provenance) = 'object'
  )
);

create index if not exists field_hail_refresh_runs_field_lookup_idx
  on app.field_hail_refresh_runs (workspace_id, field_id, requested_at desc, updated_at desc);

create index if not exists field_hail_refresh_runs_workspace_recent_idx
  on app.field_hail_refresh_runs (workspace_id, requested_at desc, updated_at desc);

create trigger field_hail_refresh_runs_set_updated_at
before update on app.field_hail_refresh_runs
for each row
execute function app.set_updated_at();

alter table app.field_hail_refresh_runs enable row level security;

create policy field_hail_refresh_runs_select_member
  on app.field_hail_refresh_runs
  for select
  to authenticated
  using (
    auth.uid() is not null
    and app.is_workspace_member(workspace_id)
  );

create policy field_hail_refresh_runs_insert_manager
  on app.field_hail_refresh_runs
  for insert
  to authenticated
  with check (
    auth.uid() is not null
    and app.can_manage_workspace(workspace_id)
  );

create policy field_hail_refresh_runs_update_manager
  on app.field_hail_refresh_runs
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

create policy field_hail_refresh_runs_delete_manager
  on app.field_hail_refresh_runs
  for delete
  to authenticated
  using (
    auth.uid() is not null
    and app.can_manage_workspace(workspace_id)
  );
