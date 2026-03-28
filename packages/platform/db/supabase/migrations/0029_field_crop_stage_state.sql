alter table app.field_crop_contexts
  add column if not exists growth_stage_source text not null default 'imported',
  add column if not exists accumulated_gdd numeric(10, 3) not null default 0,
  add column if not exists last_gdd_observed_on date,
  add column if not exists last_weather_signal_set_id uuid references app.field_weather_signal_sets(id) on delete set null,
  add column if not exists last_stage_updated_at timestamptz;

alter table app.field_crop_contexts
  drop constraint if exists field_crop_contexts_growth_stage_source_check;

alter table app.field_crop_contexts
  add constraint field_crop_contexts_growth_stage_source_check
  check (growth_stage_source in ('defaulted', 'imported', 'derived', 'manual'));

alter table app.field_crop_contexts
  drop constraint if exists field_crop_contexts_accumulated_gdd_check;

alter table app.field_crop_contexts
  add constraint field_crop_contexts_accumulated_gdd_check
  check (accumulated_gdd >= 0);
