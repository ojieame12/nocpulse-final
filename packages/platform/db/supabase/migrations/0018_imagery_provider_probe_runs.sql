create table if not exists app.imagery_provider_probe_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  field_id uuid not null references app.fields(id) on delete cascade,
  provider_key text not null,
  requested_at timestamptz not null,
  provider_status text not null check (provider_status in ('ready', 'fallback', 'unavailable')),
  discovery_mode text not null,
  materialization_mode text not null,
  discovery_client text,
  materialization_client text,
  fallback_client text,
  reason text,
  probe_status text not null check (probe_status in ('provider-scene', 'fallback-scene', 'no-scene', 'error')),
  probe_scene_key text,
  probe_captured_at timestamptz,
  probe_discovery_mode text,
  probe_discovery_client text,
  probe_reason text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists imagery_provider_probe_runs_workspace_field_created_idx
  on app.imagery_provider_probe_runs (workspace_id, field_id, created_at desc);

create index if not exists imagery_provider_probe_runs_provider_created_idx
  on app.imagery_provider_probe_runs (provider_key, created_at desc);

alter table app.imagery_provider_probe_runs enable row level security;

create policy "Workspace members can read imagery provider probe runs"
  on app.imagery_provider_probe_runs
  for select
  using (app.is_workspace_member(workspace_id));

create policy "Workspace managers can insert imagery provider probe runs"
  on app.imagery_provider_probe_runs
  for insert
  with check (app.can_manage_workspace(workspace_id));
