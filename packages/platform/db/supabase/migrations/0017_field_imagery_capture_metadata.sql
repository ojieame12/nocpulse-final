alter table app.field_imagery_captures
  add column if not exists metadata jsonb not null default '{}'::jsonb;
