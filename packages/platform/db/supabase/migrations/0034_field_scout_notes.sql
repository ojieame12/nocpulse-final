create table if not exists app.field_scout_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  field_id uuid not null references app.fields(id) on delete cascade,
  finding_id uuid null references app.field_intelligence_findings(id) on delete set null,
  zone_id uuid null references app.field_intelligence_zones(id) on delete set null,
  cell_key text null,
  outcome text not null check (outcome in ('confirmed', 'not_confirmed', 'resolved', 'monitor')),
  note_text text not null,
  observed_at timestamptz not null default timezone('utc', now()),
  created_by_user_id text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists field_scout_notes_workspace_field_idx
  on app.field_scout_notes (workspace_id, field_id, observed_at desc, created_at desc);
