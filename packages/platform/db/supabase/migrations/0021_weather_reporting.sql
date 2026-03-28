create or replace view app.field_weather_latest_observation as
select distinct on (o.workspace_id, o.field_id)
  o.id,
  o.workspace_id,
  o.field_id,
  o.observed_at,
  o.source_key,
  o.provider_key,
  o.air_temperature_c,
  o.precipitation_mm,
  o.wind_speed_kph,
  o.relative_humidity_pct,
  o.soil_moisture_pct,
  o.evapotranspiration_mm,
  o.provenance,
  o.created_at,
  o.updated_at
from app.field_weather_observations as o
order by
  o.workspace_id,
  o.field_id,
  o.observed_at desc,
  o.updated_at desc,
  o.id desc;

grant select on app.field_weather_latest_observation to authenticated;
