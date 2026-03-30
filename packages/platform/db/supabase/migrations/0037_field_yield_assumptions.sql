create table if not exists app.field_yield_assumptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  field_id uuid not null references app.fields(id) on delete cascade,
  season_year integer,
  crop_symbol text,
  yield_tonnes_per_ha numeric(12,4) not null,
  source_key text not null,
  note_text text,
  assumed_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists field_yield_assumptions_field_season_assumed_at_idx
  on app.field_yield_assumptions (workspace_id, field_id, season_year, assumed_at desc, created_at desc);
