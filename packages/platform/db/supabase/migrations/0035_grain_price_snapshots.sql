create table if not exists app.grain_price_snapshots (
  id uuid primary key default gen_random_uuid(),
  crop_symbol text not null,
  close_price_cad_per_tonne numeric(12,2) not null,
  basis_cad_per_tonne numeric(12,2) not null default 0,
  source_key text not null,
  captured_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists grain_price_snapshots_crop_symbol_captured_at_idx
  on app.grain_price_snapshots (crop_symbol, captured_at desc, created_at desc);
