alter table app.field_weather_signal_sets
  add column if not exists frost_probability_pct_7d numeric(5, 2);

alter table app.field_weather_signal_sets
  drop constraint if exists field_weather_signal_sets_nonnegative;

alter table app.field_weather_signal_sets
  add constraint field_weather_signal_sets_nonnegative check (
    leaf_wet_hours_24h >= 0
    and spray_window_count_24h >= 0
    and (frost_risk_nights_7d is null or frost_risk_nights_7d >= 0)
    and (
      frost_probability_pct_7d is null
      or (frost_probability_pct_7d >= 0 and frost_probability_pct_7d <= 100)
    )
    and (freeze_thaw_cycles_7d is null or freeze_thaw_cycles_7d >= 0)
    and (soil_temp_6cm_sustained_days is null or soil_temp_6cm_sustained_days >= 0)
    and (gdd_base_c >= 0)
  );
