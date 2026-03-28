create table if not exists app.field_intelligence_runs (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  field_id uuid not null,
  source_key text not null,
  model_key text not null,
  status text not null,
  started_at timestamptz not null,
  completed_at timestamptz,
  input_version text,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint field_intelligence_runs_field_fk
    foreign key (workspace_id, field_id)
    references app.fields(workspace_id, id)
    on delete cascade,
  constraint field_intelligence_runs_unique_source unique (
    field_id,
    source_key,
    started_at
  ),
  constraint field_intelligence_runs_status check (
    status in ('planned', 'running', 'completed', 'failed')
  ),
  constraint field_intelligence_runs_provenance_object check (
    jsonb_typeof(provenance) = 'object'
  )
);

create table if not exists app.field_intelligence_findings (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  field_id uuid not null,
  run_id uuid references app.field_intelligence_runs(id) on delete set null,
  family text not null,
  severity text not null,
  status text not null default 'active',
  source_key text not null,
  dedupe_key text not null,
  title text not null,
  summary text,
  explanation text,
  recommended_action text,
  confidence numeric(5, 4),
  zone_geojson jsonb,
  affected_cell_keys text[] not null default '{}',
  evidence jsonb not null default '{}'::jsonb,
  started_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint field_intelligence_findings_field_fk
    foreign key (workspace_id, field_id)
    references app.fields(workspace_id, id)
    on delete cascade,
  constraint field_intelligence_findings_unique_dedupe unique (
    field_id,
    dedupe_key
  ),
  constraint field_intelligence_findings_severity check (
    severity in ('low', 'medium', 'high', 'critical')
  ),
  constraint field_intelligence_findings_status check (
    status in ('active', 'resolved', 'dismissed')
  ),
  constraint field_intelligence_findings_confidence check (
    confidence is null or (confidence >= 0 and confidence <= 1)
  ),
  constraint field_intelligence_findings_zone_object check (
    zone_geojson is null or jsonb_typeof(zone_geojson) = 'object'
  ),
  constraint field_intelligence_findings_evidence_object check (
    jsonb_typeof(evidence) = 'object'
  )
);

create index if not exists field_intelligence_runs_field_lookup_idx
  on app.field_intelligence_runs (workspace_id, field_id, started_at desc, updated_at desc);

create index if not exists field_intelligence_findings_field_lookup_idx
  on app.field_intelligence_findings (workspace_id, field_id, status, started_at desc, updated_at desc);

create index if not exists field_intelligence_findings_workspace_recent_idx
  on app.field_intelligence_findings (workspace_id, status, severity, started_at desc, updated_at desc);

create trigger field_intelligence_runs_set_updated_at
before update on app.field_intelligence_runs
for each row
execute function app.set_updated_at();

create trigger field_intelligence_findings_set_updated_at
before update on app.field_intelligence_findings
for each row
execute function app.set_updated_at();

alter table app.field_intelligence_runs enable row level security;
alter table app.field_intelligence_findings enable row level security;

create policy field_intelligence_runs_select_member
  on app.field_intelligence_runs
  for select
  to authenticated
  using (
    auth.uid() is not null
    and app.is_workspace_member(workspace_id)
  );

create policy field_intelligence_runs_insert_manager
  on app.field_intelligence_runs
  for insert
  to authenticated
  with check (
    auth.uid() is not null
    and app.can_manage_workspace(workspace_id)
  );

create policy field_intelligence_runs_update_manager
  on app.field_intelligence_runs
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

create policy field_intelligence_runs_delete_manager
  on app.field_intelligence_runs
  for delete
  to authenticated
  using (
    auth.uid() is not null
    and app.can_manage_workspace(workspace_id)
  );

create policy field_intelligence_findings_select_member
  on app.field_intelligence_findings
  for select
  to authenticated
  using (
    auth.uid() is not null
    and app.is_workspace_member(workspace_id)
  );

create policy field_intelligence_findings_insert_manager
  on app.field_intelligence_findings
  for insert
  to authenticated
  with check (
    auth.uid() is not null
    and app.can_manage_workspace(workspace_id)
  );

create policy field_intelligence_findings_update_manager
  on app.field_intelligence_findings
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

create policy field_intelligence_findings_delete_manager
  on app.field_intelligence_findings
  for delete
  to authenticated
  using (
    auth.uid() is not null
    and app.can_manage_workspace(workspace_id)
  );
