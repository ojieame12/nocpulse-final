create table if not exists app.field_alerts (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  field_id uuid not null,
  family text not null,
  severity text not null,
  status text not null default 'active',
  source_key text not null,
  dedupe_key text not null,
  title text not null,
  summary text,
  explanation text,
  recommended_action text,
  facts jsonb not null default '{}'::jsonb,
  started_at timestamptz not null,
  ended_at timestamptz,
  acknowledged_at timestamptz,
  acknowledged_by_user_id uuid,
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint field_alerts_field_fk
    foreign key (workspace_id, field_id)
    references app.fields(workspace_id, id)
    on delete cascade,
  constraint field_alerts_unique_dedupe unique (field_id, dedupe_key),
  constraint field_alerts_severity check (
    severity in ('low', 'medium', 'high', 'critical')
  ),
  constraint field_alerts_status check (
    status in ('active', 'resolved', 'dismissed')
  ),
  constraint field_alerts_facts_object check (
    jsonb_typeof(facts) = 'object'
  )
);

create index if not exists field_alerts_workspace_active_idx
  on app.field_alerts (workspace_id, status, severity, started_at desc, updated_at desc);

create index if not exists field_alerts_field_lookup_idx
  on app.field_alerts (workspace_id, field_id, status, started_at desc, updated_at desc);

create trigger field_alerts_set_updated_at
before update on app.field_alerts
for each row
execute function app.set_updated_at();

alter table app.field_alerts enable row level security;

create policy field_alerts_select_member
  on app.field_alerts
  for select
  to authenticated
  using (
    auth.uid() is not null
    and app.is_workspace_member(workspace_id)
  );

create policy field_alerts_insert_manager
  on app.field_alerts
  for insert
  to authenticated
  with check (
    auth.uid() is not null
    and app.can_manage_workspace(workspace_id)
  );

create policy field_alerts_update_manager
  on app.field_alerts
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

create policy field_alerts_delete_manager
  on app.field_alerts
  for delete
  to authenticated
  using (
    auth.uid() is not null
    and app.can_manage_workspace(workspace_id)
  );
