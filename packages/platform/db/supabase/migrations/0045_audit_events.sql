create table if not exists app.audit_events (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  actor_user_id uuid not null,
  workspace_id uuid,
  resource_type text not null,
  resource_id text,
  route text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint audit_events_action_present check (length(btrim(action)) > 0),
  constraint audit_events_resource_type_present check (
    length(btrim(resource_type)) > 0
  ),
  constraint audit_events_route_present check (length(btrim(route)) > 0)
);

create index if not exists audit_events_workspace_created_idx
  on app.audit_events (workspace_id, created_at desc);

create index if not exists audit_events_actor_created_idx
  on app.audit_events (actor_user_id, created_at desc);

create index if not exists audit_events_resource_created_idx
  on app.audit_events (resource_type, resource_id, created_at desc);

create index if not exists audit_events_action_created_idx
  on app.audit_events (action, created_at desc);

alter table app.audit_events enable row level security;
