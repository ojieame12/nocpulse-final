create table if not exists app.field_weather_observations (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  field_id uuid not null,
  observed_at timestamptz not null,
  source_key text not null,
  provider_key text not null,
  air_temperature_c numeric(6, 2) not null,
  precipitation_mm numeric(8, 2) not null default 0,
  wind_speed_kph numeric(8, 2) not null default 0,
  relative_humidity_pct numeric(5, 2),
  soil_moisture_pct numeric(5, 2),
  evapotranspiration_mm numeric(8, 2),
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint field_weather_observations_field_fk
    foreign key (workspace_id, field_id)
    references app.fields(workspace_id, id)
    on delete cascade,
  constraint field_weather_observations_unique_source unique (
    field_id,
    observed_at,
    source_key
  ),
  constraint field_weather_observations_nonnegative check (
    precipitation_mm >= 0
    and wind_speed_kph >= 0
    and (relative_humidity_pct is null or (relative_humidity_pct >= 0 and relative_humidity_pct <= 100))
    and (soil_moisture_pct is null or (soil_moisture_pct >= 0 and soil_moisture_pct <= 100))
    and (evapotranspiration_mm is null or evapotranspiration_mm >= 0)
  ),
  constraint field_weather_observations_provenance_object check (
    jsonb_typeof(provenance) = 'object'
  )
);

create table if not exists app.field_weather_forecasts (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  field_id uuid not null,
  forecast_run_at timestamptz not null,
  valid_at timestamptz not null,
  source_key text not null,
  provider_key text not null,
  air_temperature_min_c numeric(6, 2) not null,
  air_temperature_max_c numeric(6, 2) not null,
  precipitation_mm numeric(8, 2) not null default 0,
  wind_speed_kph numeric(8, 2) not null default 0,
  relative_humidity_pct numeric(5, 2),
  evapotranspiration_mm numeric(8, 2),
  precipitation_probability_pct numeric(5, 2),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint field_weather_forecasts_field_fk
    foreign key (workspace_id, field_id)
    references app.fields(workspace_id, id)
    on delete cascade,
  constraint field_weather_forecasts_unique_source unique (
    field_id,
    forecast_run_at,
    valid_at,
    source_key
  ),
  constraint field_weather_forecasts_ranges check (
    precipitation_mm >= 0
    and wind_speed_kph >= 0
    and air_temperature_max_c >= air_temperature_min_c
    and (relative_humidity_pct is null or (relative_humidity_pct >= 0 and relative_humidity_pct <= 100))
    and (evapotranspiration_mm is null or evapotranspiration_mm >= 0)
    and (
      precipitation_probability_pct is null
      or (precipitation_probability_pct >= 0 and precipitation_probability_pct <= 100)
    )
  )
);

create index if not exists field_weather_observations_lookup_idx
  on app.field_weather_observations (workspace_id, field_id, observed_at desc, updated_at desc);

create index if not exists field_weather_forecasts_lookup_idx
  on app.field_weather_forecasts (workspace_id, field_id, valid_at asc, forecast_run_at desc);

create trigger field_weather_observations_set_updated_at
before update on app.field_weather_observations
for each row
execute function app.set_updated_at();

create trigger field_weather_forecasts_set_updated_at
before update on app.field_weather_forecasts
for each row
execute function app.set_updated_at();

alter table app.field_weather_observations enable row level security;
alter table app.field_weather_forecasts enable row level security;

create policy field_weather_observations_select_member
  on app.field_weather_observations
  for select
  to authenticated
  using (
    auth.uid() is not null
    and app.is_workspace_member(workspace_id)
  );

create policy field_weather_observations_insert_manager
  on app.field_weather_observations
  for insert
  to authenticated
  with check (
    auth.uid() is not null
    and app.can_manage_workspace(workspace_id)
  );

create policy field_weather_observations_update_manager
  on app.field_weather_observations
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

create policy field_weather_observations_delete_manager
  on app.field_weather_observations
  for delete
  to authenticated
  using (
    auth.uid() is not null
    and app.can_manage_workspace(workspace_id)
  );

create policy field_weather_forecasts_select_member
  on app.field_weather_forecasts
  for select
  to authenticated
  using (
    auth.uid() is not null
    and app.is_workspace_member(workspace_id)
  );

create policy field_weather_forecasts_insert_manager
  on app.field_weather_forecasts
  for insert
  to authenticated
  with check (
    auth.uid() is not null
    and app.can_manage_workspace(workspace_id)
  );

create policy field_weather_forecasts_update_manager
  on app.field_weather_forecasts
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

create policy field_weather_forecasts_delete_manager
  on app.field_weather_forecasts
  for delete
  to authenticated
  using (
    auth.uid() is not null
    and app.can_manage_workspace(workspace_id)
  );
