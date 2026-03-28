create table if not exists app.field_imagery_captures (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  field_id uuid not null references app.fields(id) on delete cascade,
  requested_at timestamptz not null,
  captured_at timestamptz not null,
  provider_key text not null,
  scene_key text not null,
  status text not null check (status in ('dry-run', 'discovered', 'materialized', 'unavailable')),
  coverage_pct numeric(5,2) not null default 0,
  cloud_cover_pct numeric(5,2) null,
  note text null,
  observation_id uuid null references app.field_raster_observations(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists field_imagery_captures_workspace_field_requested_idx
  on app.field_imagery_captures (workspace_id, field_id, requested_at desc);

create unique index if not exists field_imagery_captures_workspace_field_provider_scene_uidx
  on app.field_imagery_captures (workspace_id, field_id, provider_key, scene_key);

alter table app.field_imagery_captures enable row level security;

create policy "field imagery captures select by workspace member"
on app.field_imagery_captures
for select
using (
  exists (
    select 1
    from app.workspace_memberships memberships
    where memberships.workspace_id = field_imagery_captures.workspace_id
      and memberships.user_id = auth.uid()
  )
);

create policy "field imagery captures mutate by workspace manager"
on app.field_imagery_captures
for all
using (
  exists (
    select 1
    from app.workspace_memberships memberships
    where memberships.workspace_id = field_imagery_captures.workspace_id
      and memberships.user_id = auth.uid()
      and memberships.role in ('owner', 'manager')
  )
)
with check (
  exists (
    select 1
    from app.workspace_memberships memberships
    where memberships.workspace_id = field_imagery_captures.workspace_id
      and memberships.user_id = auth.uid()
      and memberships.role in ('owner', 'manager')
  )
);
