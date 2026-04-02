alter table app.field_weather_observations
  add column if not exists soil_temperature_6cm_c numeric(6, 2);

alter table app.field_weather_signal_sets
  add column if not exists frost_risk_min_temp_c_7d numeric(6, 2),
  add column if not exists frost_risk_nights_7d integer,
  add column if not exists recent_precip_total_72h_mm numeric(8, 2),
  add column if not exists freeze_thaw_cycles_7d integer,
  add column if not exists soil_temp_6cm_current_c numeric(6, 2),
  add column if not exists soil_temp_6cm_sustained_days integer;

alter table app.field_weather_signal_sets
  drop constraint if exists field_weather_signal_sets_nonnegative;

alter table app.field_weather_signal_sets
  add constraint field_weather_signal_sets_nonnegative check (
    leaf_wet_hours_24h >= 0
    and spray_window_count_24h >= 0
    and (frost_risk_nights_7d is null or frost_risk_nights_7d >= 0)
    and (freeze_thaw_cycles_7d is null or freeze_thaw_cycles_7d >= 0)
    and (soil_temp_6cm_sustained_days is null or soil_temp_6cm_sustained_days >= 0)
    and (gdd_base_c >= 0)
  );
