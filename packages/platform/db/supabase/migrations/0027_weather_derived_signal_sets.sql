create table if not exists app.field_weather_signal_sets (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  field_id uuid not null,
  weather_observation_id uuid references app.field_weather_observations(id) on delete set null,
  observed_at timestamptz not null,
  forecast_run_at timestamptz,
  source_key text not null,
  provider_key text not null,
  signal_version text not null,
  current_vpd_kpa numeric(6, 3),
  peak_forecast_vpd_kpa_24h numeric(6, 3),
  net_water_balance_24h_mm numeric(8, 2),
  net_water_balance_72h_mm numeric(8, 2),
  leaf_wet_hours_24h integer not null default 0,
  spray_window_count_24h integer not null default 0,
  frost_risk_min_temp_c numeric(6, 2),
  gdd_24h numeric(8, 3),
  gdd_72h numeric(8, 3),
  gdd_base_c numeric(4, 1) not null default 5,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint field_weather_signal_sets_field_fk
    foreign key (workspace_id, field_id)
    references app.fields(workspace_id, id)
    on delete cascade,
  constraint field_weather_signal_sets_unique_source unique (
    field_id,
    observed_at,
    source_key,
    signal_version
  ),
  constraint field_weather_signal_sets_nonnegative check (
    leaf_wet_hours_24h >= 0
    and spray_window_count_24h >= 0
    and (gdd_base_c >= 0)
  ),
  constraint field_weather_signal_sets_provenance_object check (
    jsonb_typeof(provenance) = 'object'
  )
);

create index if not exists field_weather_signal_sets_lookup_idx
  on app.field_weather_signal_sets (
    workspace_id,
    field_id,
    observed_at desc,
    updated_at desc
  );

create trigger field_weather_signal_sets_set_updated_at
before update on app.field_weather_signal_sets
for each row
execute function app.set_updated_at();

alter table app.field_weather_signal_sets enable row level security;

create policy field_weather_signal_sets_select_member
  on app.field_weather_signal_sets
  for select
  to authenticated
  using (
    auth.uid() is not null
    and app.is_workspace_member(workspace_id)
  );

create policy field_weather_signal_sets_insert_manager
  on app.field_weather_signal_sets
  for insert
  to authenticated
  with check (
    auth.uid() is not null
    and app.can_manage_workspace(workspace_id)
  );

create policy field_weather_signal_sets_update_manager
  on app.field_weather_signal_sets
  for update
  to authenticated
  using (
    auth.uid() is not null
    and app.can_manage_workspace(workspace_id)
  )
  with check (
    auth.uid() is not null
    and app.can_manage_workspace(workspace_id)
  );

create policy field_weather_signal_sets_delete_manager
  on app.field_weather_signal_sets
  for delete
  to authenticated
  using (
    auth.uid() is not null
    and app.can_manage_workspace(workspace_id)
  );
