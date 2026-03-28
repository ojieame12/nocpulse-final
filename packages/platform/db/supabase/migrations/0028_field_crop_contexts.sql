create table if not exists app.field_crop_contexts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  field_id uuid not null references app.fields(id) on delete cascade,
  season_year integer not null,
  crop_type text not null,
  growth_stage text,
  source_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, field_id, season_year),
  check (season_year >= 2000 and season_year <= 2100),
  check (length(trim(crop_type)) > 0),
  check (length(trim(source_key)) > 0)
);

create index if not exists field_crop_contexts_workspace_field_idx
  on app.field_crop_contexts (workspace_id, field_id, season_year desc, updated_at desc);

alter table app.field_crop_contexts enable row level security;

create policy "Workspace members can read field crop contexts"
on app.field_crop_contexts
for select
using (
  app.is_workspace_member(workspace_id)
);

create policy "Workspace members can write field crop contexts"
on app.field_crop_contexts
for all
using (
  app.is_workspace_member(workspace_id)
)
with check (
  app.is_workspace_member(workspace_id)
);

drop trigger if exists set_field_crop_contexts_updated_at on app.field_crop_contexts;
create trigger set_field_crop_contexts_updated_at
before update on app.field_crop_contexts
for each row
execute function app.set_updated_at();
