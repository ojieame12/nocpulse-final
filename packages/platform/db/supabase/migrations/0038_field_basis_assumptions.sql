create table if not exists app.field_basis_assumptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references app.workspaces (id) on delete cascade,
  field_id uuid not null references app.fields (id) on delete cascade,
  season_year integer,
  crop_symbol text,
  basis_cad_per_tonne numeric(12, 4) not null,
  source_key text not null,
  note_text text,
  assumed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists field_basis_assumptions_lookup_idx
  on app.field_basis_assumptions (
    workspace_id,
    field_id,
    season_year,
    assumed_at desc,
    created_at desc
  );
