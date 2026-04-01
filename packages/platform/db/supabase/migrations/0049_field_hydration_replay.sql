create or replace function app.replay_field_hydration_from_source(
  source_field_id uuid,
  target_workspace_id uuid,
  target_field_id uuid,
  target_crop_type text default null
)
returns table (
  copied_crop_context boolean,
  weather_observation_count integer,
  weather_forecast_count integer,
  weather_signal_set boolean,
  moisture_snapshot_count integer,
  moisture_cell_count integer,
  raster_observation boolean
)
language plpgsql
security invoker
set search_path = app, public, extensions
as $$
declare
  source_field_row app.fields;
  source_workspace_slug text;
  source_signal_set_row app.field_weather_signal_sets;
  source_crop_context_row app.field_crop_contexts;
  latest_source_snapshot_row app.field_moisture_snapshots;
  latest_source_raster_row app.field_raster_observations;
  latest_source_forecast_run_at timestamptz;
  target_weather_observation_id uuid;
  target_signal_set_id uuid;
  target_snapshot_id uuid;
  target_raster_observation_id uuid;
begin
  copied_crop_context := false;
  weather_observation_count := 0;
  weather_forecast_count := 0;
  weather_signal_set := false;
  moisture_snapshot_count := 0;
  moisture_cell_count := 0;
  raster_observation := false;

  select *
  into source_field_row
  from app.fields
  where id = source_field_id;

  if not found then
    raise exception 'replay_field_hydration_from_source: source field % not found', source_field_id;
  end if;

  perform 1
  from app.fields
  where workspace_id = target_workspace_id
    and id = target_field_id;

  if not found then
    raise exception 'replay_field_hydration_from_source: target field % in workspace % not found', target_field_id, target_workspace_id;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(target_workspace_id::text || ':' || target_field_id::text, 0)
  );

  select slug
  into source_workspace_slug
  from app.workspaces
  where id = source_field_row.workspace_id;

  with source_weather as (
    select *
    from app.field_weather_observations
    where workspace_id = source_field_row.workspace_id
      and field_id = source_field_id
    order by observed_at desc, updated_at desc
    limit 7
  ),
  ordered_source_weather as (
    select *
    from source_weather
    order by observed_at asc, updated_at asc
  ),
  upserted_weather as (
    insert into app.field_weather_observations (
      workspace_id,
      field_id,
      observed_at,
      source_key,
      provider_key,
      air_temperature_c,
      precipitation_mm,
      wind_speed_kph,
      relative_humidity_pct,
      soil_moisture_pct,
      evapotranspiration_mm,
      provenance
    )
    select
      target_workspace_id,
      target_field_id,
      observed_at,
      source_key,
      provider_key,
      air_temperature_c,
      precipitation_mm,
      wind_speed_kph,
      relative_humidity_pct,
      soil_moisture_pct,
      evapotranspiration_mm,
      provenance
    from ordered_source_weather
    on conflict (field_id, observed_at, source_key) do update
    set
      provider_key = excluded.provider_key,
      air_temperature_c = excluded.air_temperature_c,
      precipitation_mm = excluded.precipitation_mm,
      wind_speed_kph = excluded.wind_speed_kph,
      relative_humidity_pct = excluded.relative_humidity_pct,
      soil_moisture_pct = excluded.soil_moisture_pct,
      evapotranspiration_mm = excluded.evapotranspiration_mm,
      provenance = excluded.provenance
    returning id
  )
  select count(*)::integer
  into weather_observation_count
  from upserted_weather;

  select *
  into source_signal_set_row
  from app.field_weather_signal_sets
  where workspace_id = source_field_row.workspace_id
    and field_id = source_field_id
  order by observed_at desc, updated_at desc
  limit 1;

  if found then
    if source_signal_set_row.weather_observation_id is not null then
      select id
      into target_weather_observation_id
      from app.field_weather_observations
      where workspace_id = target_workspace_id
        and field_id = target_field_id
        and observed_at = source_signal_set_row.observed_at
        and source_key = source_signal_set_row.source_key
      order by updated_at desc
      limit 1;
    else
      target_weather_observation_id := null;
    end if;

    insert into app.field_weather_signal_sets (
      workspace_id,
      field_id,
      weather_observation_id,
      observed_at,
      forecast_run_at,
      source_key,
      provider_key,
      signal_version,
      current_vpd_kpa,
      peak_forecast_vpd_kpa_24h,
      net_water_balance_24h_mm,
      net_water_balance_72h_mm,
      leaf_wet_hours_24h,
      spray_window_count_24h,
      frost_risk_min_temp_c,
      gdd_24h,
      gdd_72h,
      gdd_base_c,
      provenance
    )
    values (
      target_workspace_id,
      target_field_id,
      target_weather_observation_id,
      source_signal_set_row.observed_at,
      source_signal_set_row.forecast_run_at,
      source_signal_set_row.source_key,
      source_signal_set_row.provider_key,
      source_signal_set_row.signal_version,
      source_signal_set_row.current_vpd_kpa,
      source_signal_set_row.peak_forecast_vpd_kpa_24h,
      source_signal_set_row.net_water_balance_24h_mm,
      source_signal_set_row.net_water_balance_72h_mm,
      source_signal_set_row.leaf_wet_hours_24h,
      source_signal_set_row.spray_window_count_24h,
      source_signal_set_row.frost_risk_min_temp_c,
      source_signal_set_row.gdd_24h,
      source_signal_set_row.gdd_72h,
      source_signal_set_row.gdd_base_c,
      source_signal_set_row.provenance
    )
    on conflict (field_id, observed_at, source_key, signal_version) do update
    set
      weather_observation_id = excluded.weather_observation_id,
      forecast_run_at = excluded.forecast_run_at,
      provider_key = excluded.provider_key,
      current_vpd_kpa = excluded.current_vpd_kpa,
      peak_forecast_vpd_kpa_24h = excluded.peak_forecast_vpd_kpa_24h,
      net_water_balance_24h_mm = excluded.net_water_balance_24h_mm,
      net_water_balance_72h_mm = excluded.net_water_balance_72h_mm,
      leaf_wet_hours_24h = excluded.leaf_wet_hours_24h,
      spray_window_count_24h = excluded.spray_window_count_24h,
      frost_risk_min_temp_c = excluded.frost_risk_min_temp_c,
      gdd_24h = excluded.gdd_24h,
      gdd_72h = excluded.gdd_72h,
      gdd_base_c = excluded.gdd_base_c,
      provenance = excluded.provenance
    returning id
    into target_signal_set_id;

    weather_signal_set := true;
  else
    target_signal_set_id := null;
  end if;

  select forecast_run_at
  into latest_source_forecast_run_at
  from app.field_weather_forecasts
  where workspace_id = source_field_row.workspace_id
    and field_id = source_field_id
  order by forecast_run_at desc, updated_at desc
  limit 1;

  if latest_source_forecast_run_at is not null then
    delete from app.field_weather_forecasts
    where workspace_id = target_workspace_id
      and field_id = target_field_id
      and forecast_run_at = latest_source_forecast_run_at
      and source_key in (
        select distinct source_key
        from app.field_weather_forecasts
        where workspace_id = source_field_row.workspace_id
          and field_id = source_field_id
          and forecast_run_at = latest_source_forecast_run_at
      );

    with source_forecasts as (
      select *
      from app.field_weather_forecasts
      where workspace_id = source_field_row.workspace_id
        and field_id = source_field_id
        and forecast_run_at = latest_source_forecast_run_at
      order by valid_at asc, updated_at desc
      limit 48
    ),
    inserted_forecasts as (
      insert into app.field_weather_forecasts (
        workspace_id,
        field_id,
        forecast_run_at,
        valid_at,
        source_key,
        provider_key,
        air_temperature_min_c,
        air_temperature_max_c,
        precipitation_mm,
        wind_speed_kph,
        relative_humidity_pct,
        evapotranspiration_mm,
        precipitation_probability_pct
      )
      select
        target_workspace_id,
        target_field_id,
        forecast_run_at,
        valid_at,
        source_key,
        provider_key,
        air_temperature_min_c,
        air_temperature_max_c,
        precipitation_mm,
        wind_speed_kph,
        relative_humidity_pct,
        evapotranspiration_mm,
        precipitation_probability_pct
      from source_forecasts
      returning id
    )
    select count(*)::integer
    into weather_forecast_count
    from inserted_forecasts;
  end if;

  select *
  into source_crop_context_row
  from app.field_crop_contexts
  where workspace_id = source_field_row.workspace_id
    and field_id = source_field_id
  order by season_year desc, updated_at desc
  limit 1;

  if found then
    insert into app.field_crop_contexts (
      workspace_id,
      field_id,
      season_year,
      crop_type,
      growth_stage,
      growth_stage_source,
      accumulated_gdd,
      last_gdd_observed_on,
      last_weather_signal_set_id,
      last_stage_updated_at,
      source_key,
      metadata
    )
    values (
      target_workspace_id,
      target_field_id,
      source_crop_context_row.season_year,
      coalesce(nullif(btrim(target_crop_type), ''), source_crop_context_row.crop_type),
      source_crop_context_row.growth_stage,
      source_crop_context_row.growth_stage_source,
      source_crop_context_row.accumulated_gdd,
      source_crop_context_row.last_gdd_observed_on,
      target_signal_set_id,
      source_crop_context_row.last_stage_updated_at,
      'field-intake:hydration-replay',
      jsonb_build_object(
        'replaySourceFieldId', source_field_id,
        'replaySourceWorkspaceId', source_field_row.workspace_id,
        'replaySourceWorkspaceSlug', source_workspace_slug,
        'replaySourceKey', source_crop_context_row.source_key
      )
    )
    on conflict (workspace_id, field_id, season_year) do update
    set
      crop_type = excluded.crop_type,
      growth_stage = excluded.growth_stage,
      growth_stage_source = excluded.growth_stage_source,
      accumulated_gdd = excluded.accumulated_gdd,
      last_gdd_observed_on = excluded.last_gdd_observed_on,
      last_weather_signal_set_id = excluded.last_weather_signal_set_id,
      last_stage_updated_at = excluded.last_stage_updated_at,
      source_key = excluded.source_key,
      metadata = excluded.metadata;

    copied_crop_context := true;
  end if;

  with source_snapshots as (
    select *
    from app.field_moisture_snapshots
    where workspace_id = source_field_row.workspace_id
      and field_id = source_field_id
    order by observed_at desc, created_at desc
    limit 14
  ),
  ordered_source_snapshots as (
    select *
    from source_snapshots
    order by observed_at asc, created_at asc
  ),
  upserted_snapshots as (
    insert into app.field_moisture_snapshots (
      workspace_id,
      field_id,
      observed_at,
      source_key,
      root_zone_pct,
      surface_pct,
      confidence,
      inputs
    )
    select
      target_workspace_id,
      target_field_id,
      observed_at,
      source_key,
      root_zone_pct,
      surface_pct,
      confidence,
      inputs
    from ordered_source_snapshots
    on conflict (field_id, observed_at, source_key) do update
    set
      root_zone_pct = excluded.root_zone_pct,
      surface_pct = excluded.surface_pct,
      confidence = excluded.confidence,
      inputs = excluded.inputs
    returning id
  )
  select count(*)::integer
  into moisture_snapshot_count
  from upserted_snapshots;

  select *
  into latest_source_snapshot_row
  from app.field_moisture_snapshots
  where workspace_id = source_field_row.workspace_id
    and field_id = source_field_id
  order by observed_at desc, created_at desc
  limit 1;

  if found then
    select id
    into target_snapshot_id
    from app.field_moisture_snapshots
    where workspace_id = target_workspace_id
      and field_id = target_field_id
      and observed_at = latest_source_snapshot_row.observed_at
      and source_key = latest_source_snapshot_row.source_key
    order by created_at desc
    limit 1;

    if target_snapshot_id is not null then
      delete from app.field_moisture_cell_snapshots
      where workspace_id = target_workspace_id
        and field_id = target_field_id
        and snapshot_id = target_snapshot_id;

      with inserted_cells as (
        insert into app.field_moisture_cell_snapshots (
          workspace_id,
          field_id,
          snapshot_id,
          observed_at,
          source_key,
          cell_key,
          row_index,
          column_index,
          centroid,
          boundary,
          root_zone_pct,
          surface_pct,
          confidence
        )
        select
          target_workspace_id,
          target_field_id,
          target_snapshot_id,
          latest_source_snapshot_row.observed_at,
          latest_source_snapshot_row.source_key,
          cell_key,
          row_index,
          column_index,
          centroid,
          boundary,
          root_zone_pct,
          surface_pct,
          confidence
        from app.field_moisture_cell_snapshots
        where workspace_id = source_field_row.workspace_id
          and field_id = source_field_id
          and snapshot_id = latest_source_snapshot_row.id
        returning id
      )
      select count(*)::integer
      into moisture_cell_count
      from inserted_cells;
    end if;
  end if;

  select *
  into latest_source_raster_row
  from app.field_raster_observations
  where workspace_id = source_field_row.workspace_id
    and field_id = source_field_id
  order by
    case
      when metadata ->> 'mode' = 'synthetic-seeded' then 0
      when metadata ->> 'materializationMode' = 'provider'
        or source_key not like 'synthetic-%' then 3
      when metadata ->> 'materializationMode' in ('synthetic', 'synthetic-fallback') then 2
      else 1
    end desc,
    observed_at desc,
    created_at desc
  limit 1;

  if found then
    delete from app.field_raster_observations
    where workspace_id = target_workspace_id
      and field_id = target_field_id
      and source_key = latest_source_raster_row.source_key
      and observed_at = latest_source_raster_row.observed_at;

    insert into app.field_raster_observations (
      workspace_id,
      field_id,
      observed_at,
      source_key,
      provider_key,
      artifact_key,
      metadata
    )
    values (
      target_workspace_id,
      target_field_id,
      latest_source_raster_row.observed_at,
      latest_source_raster_row.source_key,
      latest_source_raster_row.provider_key,
      latest_source_raster_row.artifact_key,
      latest_source_raster_row.metadata
    )
    returning id
    into target_raster_observation_id;

    insert into app.field_raster_observation_cells (
      observation_id,
      workspace_id,
      field_id,
      observed_at,
      source_key,
      provider_key,
      cell_key,
      row_index,
      column_index,
      centroid,
      boundary,
      measurements
    )
    select
      target_raster_observation_id,
      target_workspace_id,
      target_field_id,
      latest_source_raster_row.observed_at,
      latest_source_raster_row.source_key,
      latest_source_raster_row.provider_key,
      cell_key,
      row_index,
      column_index,
      centroid,
      boundary,
      measurements
    from app.field_raster_observation_cells
    where observation_id = latest_source_raster_row.id;

    raster_observation := true;
  end if;

  return next;
end;
$$;

grant execute on function app.replay_field_hydration_from_source(uuid, uuid, uuid, text) to service_role;
