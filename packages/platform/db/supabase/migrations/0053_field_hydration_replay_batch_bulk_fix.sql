create or replace function app.replay_field_hydration_from_committed_batch(
  target_workspace_id uuid,
  target_batch_id uuid
)
returns table (
  target_field_id uuid,
  action text,
  reason text,
  source_field_id uuid,
  source_workspace_id uuid,
  source_workspace_slug text,
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
begin
  create temporary table if not exists pg_temp.replay_batch_source_candidates (
    target_field_id uuid primary key,
    target_crop_type text,
    action text not null,
    reason text,
    source_field_id uuid,
    source_workspace_id uuid,
    source_workspace_slug text
  ) on commit drop;

  create temporary table if not exists pg_temp.replay_batch_results (
    target_field_id uuid primary key,
    action text not null,
    reason text,
    source_field_id uuid,
    source_workspace_id uuid,
    source_workspace_slug text,
    copied_crop_context boolean not null default false,
    weather_observation_count integer not null default 0,
    weather_forecast_count integer not null default 0,
    weather_signal_set boolean not null default false,
    moisture_snapshot_count integer not null default 0,
    moisture_cell_count integer not null default 0,
    raster_observation boolean not null default false
  ) on commit drop;

  create temporary table if not exists pg_temp.replay_batch_latest_signals (
    target_field_id uuid primary key,
    source_workspace_id uuid not null,
    source_field_id uuid not null,
    observed_at timestamptz not null,
    forecast_run_at timestamptz,
    source_key text not null,
    provider_key text not null,
    signal_version text not null,
    current_vpd_kpa numeric(6, 3),
    peak_forecast_vpd_kpa_24h numeric(6, 3),
    net_water_balance_24h_mm numeric(8, 2),
    net_water_balance_72h_mm numeric(8, 2),
    leaf_wet_hours_24h integer not null,
    spray_window_count_24h integer not null,
    frost_risk_min_temp_c numeric(6, 2),
    gdd_24h numeric(8, 3),
    gdd_72h numeric(8, 3),
    gdd_base_c numeric(4, 1) not null,
    provenance jsonb not null
  ) on commit drop;

  create temporary table if not exists pg_temp.replay_batch_latest_snapshots (
    target_field_id uuid primary key,
    source_workspace_id uuid not null,
    source_field_id uuid not null,
    snapshot_id uuid not null,
    observed_at timestamptz not null,
    source_key text not null
  ) on commit drop;

  create temporary table if not exists pg_temp.replay_batch_latest_rasters (
    target_field_id uuid primary key,
    source_workspace_id uuid not null,
    source_field_id uuid not null,
    observation_id uuid not null,
    observed_at timestamptz not null,
    source_key text not null,
    provider_key text not null,
    artifact_key text,
    metadata jsonb not null
  ) on commit drop;

  truncate table
    pg_temp.replay_batch_source_candidates,
    pg_temp.replay_batch_results,
    pg_temp.replay_batch_latest_signals,
    pg_temp.replay_batch_latest_snapshots,
    pg_temp.replay_batch_latest_rasters;

  insert into pg_temp.replay_batch_source_candidates (
    target_field_id,
    target_crop_type,
    action,
    reason,
    source_field_id,
    source_workspace_id,
    source_workspace_slug
  )
  with batch_candidates as (
    select
      candidate_row.committed_field_id as target_field_id,
      nullif(btrim(candidate_row.name), '') as target_field_name,
      candidate_row.crop_type as target_crop_type,
      array(
        select jsonb_array_elements_text(candidate_row.legal_land_descriptions)
      )::text[] as target_legal_land_descriptions
    from app.field_import_candidates candidate_row
    where candidate_row.workspace_id = target_workspace_id
      and candidate_row.batch_id = target_batch_id
      and candidate_row.status = 'committed'
      and candidate_row.commit_action = 'created'
      and candidate_row.committed_field_id is not null
    order by candidate_row.ordinal asc
  ),
  resolved_candidates as (
    select
      candidate.target_field_id,
      candidate.target_crop_type,
      case
        when coalesce(array_length(candidate.target_legal_land_descriptions, 1), 0) = 0
          and candidate.target_field_name is null
          then 'skipped'
        when coalesce(counts.all_count, 0) = 0
          then 'skipped'
        when coalesce(counts.external_count, 0) = 0
          then 'skipped'
        when best_source.source_field_id is null
          then 'skipped'
        when not best_source.hydrated
          then 'skipped'
        else 'replayed'
      end as action,
      case
        when coalesce(array_length(candidate.target_legal_land_descriptions, 1), 0) = 0
          and candidate.target_field_name is null
          then 'missing-stable-key'
        when coalesce(counts.all_count, 0) = 0
          then 'no-source-field'
        when coalesce(counts.external_count, 0) = 0
          then 'target-workspace-only'
        when best_source.source_field_id is null
          then 'no-source-field'
        when not best_source.hydrated
          then 'no-hydrated-source'
        else null
      end as reason,
      best_source.source_field_id,
      best_source.source_workspace_id,
      best_source.source_workspace_slug
    from batch_candidates candidate
    left join lateral (
      select
        count(*)::integer as all_count,
        count(*) filter (where field_row.workspace_id <> target_workspace_id)::integer as external_count
      from app.fields field_row
      where (
        coalesce(array_length(candidate.target_legal_land_descriptions, 1), 0) > 0
        and field_row.legal_land_description = any(candidate.target_legal_land_descriptions)
      ) or (
        candidate.target_field_name is not null
        and lower(btrim(field_row.name)) = lower(candidate.target_field_name)
      )
    ) counts on true
    left join lateral (
      with ranked_sources as (
        select
          field_row.id as source_field_id,
          field_row.workspace_id as source_workspace_id,
          workspace_row.slug as source_workspace_slug,
          (
            coalesce(array_length(candidate.target_legal_land_descriptions, 1), 0) > 0
            and field_row.legal_land_description = any(candidate.target_legal_land_descriptions)
          ) as lld_matched,
          (
            candidate.target_field_name is not null
            and lower(btrim(field_row.name)) = lower(candidate.target_field_name)
          ) as name_matched,
          exists(
            select 1
            from app.field_crop_contexts crop_context
            where crop_context.workspace_id = field_row.workspace_id
              and crop_context.field_id = field_row.id
          ) as has_crop_context,
          exists(
            select 1
            from app.field_weather_observations weather_observation
            where weather_observation.workspace_id = field_row.workspace_id
              and weather_observation.field_id = field_row.id
          ) as has_weather_observations,
          exists(
            select 1
            from app.field_weather_signal_sets signal_set
            where signal_set.workspace_id = field_row.workspace_id
              and signal_set.field_id = field_row.id
          ) as has_weather_signal_set,
          exists(
            select 1
            from app.field_weather_forecasts forecast_row
            where forecast_row.workspace_id = field_row.workspace_id
              and forecast_row.field_id = field_row.id
          ) as has_weather_forecasts,
          exists(
            select 1
            from app.field_moisture_snapshots moisture_snapshot
            where moisture_snapshot.workspace_id = field_row.workspace_id
              and moisture_snapshot.field_id = field_row.id
          ) as has_moisture_snapshots,
          exists(
            select 1
            from app.field_moisture_cell_snapshots moisture_cell
            where moisture_cell.workspace_id = field_row.workspace_id
              and moisture_cell.field_id = field_row.id
          ) as has_moisture_cells,
          exists(
            select 1
            from app.field_raster_observations raster_observation
            where raster_observation.workspace_id = field_row.workspace_id
              and raster_observation.field_id = field_row.id
          ) as has_raster_observation
        from app.fields field_row
        join app.workspaces workspace_row
          on workspace_row.id = field_row.workspace_id
        where field_row.workspace_id <> target_workspace_id
          and (
            (
              coalesce(array_length(candidate.target_legal_land_descriptions, 1), 0) > 0
              and field_row.legal_land_description = any(candidate.target_legal_land_descriptions)
            ) or (
              candidate.target_field_name is not null
              and lower(btrim(field_row.name)) = lower(candidate.target_field_name)
            )
          )
      )
      select
        ranked_sources.source_field_id,
        ranked_sources.source_workspace_id,
        ranked_sources.source_workspace_slug,
        (
          ranked_sources.has_weather_observations
          or ranked_sources.has_moisture_snapshots
          or ranked_sources.has_raster_observation
        ) as hydrated
      from ranked_sources
      order by
        (
          ranked_sources.has_weather_observations
          or ranked_sources.has_moisture_snapshots
          or ranked_sources.has_raster_observation
        ) desc,
        (
          ranked_sources.has_crop_context::integer
          + ranked_sources.has_weather_observations::integer
          + ranked_sources.has_weather_signal_set::integer
          + ranked_sources.has_weather_forecasts::integer
          + ranked_sources.has_moisture_snapshots::integer
          + ranked_sources.has_moisture_cells::integer
          + ranked_sources.has_raster_observation::integer
        ) desc,
        ranked_sources.lld_matched desc,
        ranked_sources.name_matched desc,
        (ranked_sources.source_workspace_slug = 'hope-creek-farms') desc,
        ranked_sources.source_field_id asc
      limit 1
    ) best_source on true
  )
  select
    resolved_candidates.target_field_id,
    resolved_candidates.target_crop_type,
    resolved_candidates.action,
    resolved_candidates.reason,
    resolved_candidates.source_field_id,
    resolved_candidates.source_workspace_id,
    resolved_candidates.source_workspace_slug
  from resolved_candidates;

  insert into pg_temp.replay_batch_results (
    target_field_id,
    action,
    reason,
    source_field_id,
    source_workspace_id,
    source_workspace_slug
  )
  select
    source_candidate.target_field_id,
    source_candidate.action,
    source_candidate.reason,
    source_candidate.source_field_id,
    source_candidate.source_workspace_id,
    source_candidate.source_workspace_slug
  from pg_temp.replay_batch_source_candidates source_candidate;

  perform pg_advisory_xact_lock(
    hashtextextended(target_workspace_id::text || ':' || source_candidate.target_field_id::text, 0)
  )
  from pg_temp.replay_batch_source_candidates source_candidate
  where source_candidate.action = 'replayed'
  order by source_candidate.target_field_id;

  with source_weather as (
    select
      source_candidate.target_field_id,
      weather_observation.observed_at,
      weather_observation.source_key,
      weather_observation.provider_key,
      weather_observation.air_temperature_c,
      weather_observation.precipitation_mm,
      weather_observation.wind_speed_kph,
      weather_observation.relative_humidity_pct,
      weather_observation.soil_moisture_pct,
      weather_observation.evapotranspiration_mm,
      weather_observation.provenance,
      row_number() over (
        partition by source_candidate.target_field_id
        order by weather_observation.observed_at desc, weather_observation.updated_at desc
      ) as weather_rank
    from pg_temp.replay_batch_source_candidates source_candidate
    join app.field_weather_observations weather_observation
      on weather_observation.workspace_id = source_candidate.source_workspace_id
     and weather_observation.field_id = source_candidate.source_field_id
    where source_candidate.action = 'replayed'
  ),
  selected_weather as (
    select *
    from source_weather
    where weather_rank <= 7
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
      selected_weather.target_field_id,
      selected_weather.observed_at,
      selected_weather.source_key,
      selected_weather.provider_key,
      selected_weather.air_temperature_c,
      selected_weather.precipitation_mm,
      selected_weather.wind_speed_kph,
      selected_weather.relative_humidity_pct,
      selected_weather.soil_moisture_pct,
      selected_weather.evapotranspiration_mm,
      selected_weather.provenance
    from selected_weather
    order by selected_weather.target_field_id, selected_weather.observed_at asc
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
    returning field_id
  ),
  weather_counts as (
    select field_id as target_field_id, count(*)::integer as weather_count
    from upserted_weather
    group by field_id
  )
  update pg_temp.replay_batch_results replay_result
  set weather_observation_count = weather_counts.weather_count
  from weather_counts
  where replay_result.target_field_id = weather_counts.target_field_id;

  insert into pg_temp.replay_batch_latest_signals (
    target_field_id,
    source_workspace_id,
    source_field_id,
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
  select distinct on (source_candidate.target_field_id)
    source_candidate.target_field_id,
    source_candidate.source_workspace_id,
    source_candidate.source_field_id,
    signal_set.observed_at,
    signal_set.forecast_run_at,
    signal_set.source_key,
    signal_set.provider_key,
    signal_set.signal_version,
    signal_set.current_vpd_kpa,
    signal_set.peak_forecast_vpd_kpa_24h,
    signal_set.net_water_balance_24h_mm,
    signal_set.net_water_balance_72h_mm,
    signal_set.leaf_wet_hours_24h,
    signal_set.spray_window_count_24h,
    signal_set.frost_risk_min_temp_c,
    signal_set.gdd_24h,
    signal_set.gdd_72h,
    signal_set.gdd_base_c,
    signal_set.provenance
  from pg_temp.replay_batch_source_candidates source_candidate
  join app.field_weather_signal_sets signal_set
    on signal_set.workspace_id = source_candidate.source_workspace_id
   and signal_set.field_id = source_candidate.source_field_id
  where source_candidate.action = 'replayed'
  order by source_candidate.target_field_id, signal_set.observed_at desc, signal_set.updated_at desc;

  with signal_targets as (
    select
      latest_signal.target_field_id,
      weather_target.id as target_weather_observation_id,
      latest_signal.observed_at,
      latest_signal.forecast_run_at,
      latest_signal.source_key,
      latest_signal.provider_key,
      latest_signal.signal_version,
      latest_signal.current_vpd_kpa,
      latest_signal.peak_forecast_vpd_kpa_24h,
      latest_signal.net_water_balance_24h_mm,
      latest_signal.net_water_balance_72h_mm,
      latest_signal.leaf_wet_hours_24h,
      latest_signal.spray_window_count_24h,
      latest_signal.frost_risk_min_temp_c,
      latest_signal.gdd_24h,
      latest_signal.gdd_72h,
      latest_signal.gdd_base_c,
      latest_signal.provenance
    from pg_temp.replay_batch_latest_signals latest_signal
    left join lateral (
      select weather_observation.id
      from app.field_weather_observations weather_observation
      where weather_observation.workspace_id = target_workspace_id
        and weather_observation.field_id = latest_signal.target_field_id
        and weather_observation.observed_at = latest_signal.observed_at
        and weather_observation.source_key = latest_signal.source_key
      order by weather_observation.updated_at desc
      limit 1
    ) weather_target on true
  ),
  upserted_signals as (
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
    select
      target_workspace_id,
      signal_targets.target_field_id,
      signal_targets.target_weather_observation_id,
      signal_targets.observed_at,
      signal_targets.forecast_run_at,
      signal_targets.source_key,
      signal_targets.provider_key,
      signal_targets.signal_version,
      signal_targets.current_vpd_kpa,
      signal_targets.peak_forecast_vpd_kpa_24h,
      signal_targets.net_water_balance_24h_mm,
      signal_targets.net_water_balance_72h_mm,
      signal_targets.leaf_wet_hours_24h,
      signal_targets.spray_window_count_24h,
      signal_targets.frost_risk_min_temp_c,
      signal_targets.gdd_24h,
      signal_targets.gdd_72h,
      signal_targets.gdd_base_c,
      signal_targets.provenance
    from signal_targets
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
    returning field_id
  )
  update pg_temp.replay_batch_results replay_result
  set weather_signal_set = true
  from (select distinct field_id as target_field_id from upserted_signals) signal_counts
  where replay_result.target_field_id = signal_counts.target_field_id;

  with latest_forecast_runs as (
    select distinct on (source_candidate.target_field_id)
      source_candidate.target_field_id,
      source_candidate.source_workspace_id,
      source_candidate.source_field_id,
      forecast_row.forecast_run_at
    from pg_temp.replay_batch_source_candidates source_candidate
    join app.field_weather_forecasts forecast_row
      on forecast_row.workspace_id = source_candidate.source_workspace_id
     and forecast_row.field_id = source_candidate.source_field_id
    where source_candidate.action = 'replayed'
    order by source_candidate.target_field_id, forecast_row.forecast_run_at desc, forecast_row.updated_at desc
  ),
  deleted_target_forecasts as (
    delete from app.field_weather_forecasts target_forecast
    using latest_forecast_runs latest_forecast_run
    where target_forecast.workspace_id = target_workspace_id
      and target_forecast.field_id = latest_forecast_run.target_field_id
      and target_forecast.forecast_run_at = latest_forecast_run.forecast_run_at
      and exists (
        select 1
        from app.field_weather_forecasts source_forecast
        where source_forecast.workspace_id = latest_forecast_run.source_workspace_id
          and source_forecast.field_id = latest_forecast_run.source_field_id
          and source_forecast.forecast_run_at = latest_forecast_run.forecast_run_at
          and source_forecast.source_key = target_forecast.source_key
      )
    returning target_forecast.field_id
  ),
  source_forecasts as (
    select
      latest_forecast_run.target_field_id,
      forecast_row.forecast_run_at,
      forecast_row.valid_at,
      forecast_row.source_key,
      forecast_row.provider_key,
      forecast_row.air_temperature_min_c,
      forecast_row.air_temperature_max_c,
      forecast_row.precipitation_mm,
      forecast_row.wind_speed_kph,
      forecast_row.relative_humidity_pct,
      forecast_row.evapotranspiration_mm,
      forecast_row.precipitation_probability_pct,
      row_number() over (
        partition by latest_forecast_run.target_field_id
        order by forecast_row.valid_at asc, forecast_row.updated_at desc
      ) as forecast_rank
    from latest_forecast_runs latest_forecast_run
    join app.field_weather_forecasts forecast_row
      on forecast_row.workspace_id = latest_forecast_run.source_workspace_id
     and forecast_row.field_id = latest_forecast_run.source_field_id
     and forecast_row.forecast_run_at = latest_forecast_run.forecast_run_at
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
      source_forecasts.target_field_id,
      source_forecasts.forecast_run_at,
      source_forecasts.valid_at,
      source_forecasts.source_key,
      source_forecasts.provider_key,
      source_forecasts.air_temperature_min_c,
      source_forecasts.air_temperature_max_c,
      source_forecasts.precipitation_mm,
      source_forecasts.wind_speed_kph,
      source_forecasts.relative_humidity_pct,
      source_forecasts.evapotranspiration_mm,
      source_forecasts.precipitation_probability_pct
    from source_forecasts
    where source_forecasts.forecast_rank <= 48
    returning field_id
  ),
  forecast_counts as (
    select field_id as target_field_id, count(*)::integer as forecast_count
    from inserted_forecasts
    group by field_id
  )
  update pg_temp.replay_batch_results replay_result
  set weather_forecast_count = forecast_counts.forecast_count
  from forecast_counts
  where replay_result.target_field_id = forecast_counts.target_field_id;

  with latest_crop_contexts as (
    select distinct on (source_candidate.target_field_id)
      source_candidate.target_field_id,
      source_candidate.target_crop_type,
      source_candidate.source_field_id,
      source_candidate.source_workspace_id,
      source_candidate.source_workspace_slug,
      crop_context.season_year,
      crop_context.crop_type,
      crop_context.growth_stage,
      crop_context.growth_stage_source,
      crop_context.accumulated_gdd,
      crop_context.last_gdd_observed_on,
      crop_context.last_stage_updated_at,
      crop_context.source_key as source_crop_context_key,
      crop_context.metadata
    from pg_temp.replay_batch_source_candidates source_candidate
    join app.field_crop_contexts crop_context
      on crop_context.workspace_id = source_candidate.source_workspace_id
     and crop_context.field_id = source_candidate.source_field_id
    where source_candidate.action = 'replayed'
    order by source_candidate.target_field_id, crop_context.season_year desc, crop_context.updated_at desc
  ),
  crop_context_targets as (
    select
      latest_crop_context.target_field_id,
      latest_crop_context.season_year,
      coalesce(nullif(btrim(latest_crop_context.target_crop_type), ''), latest_crop_context.crop_type) as crop_type,
      latest_crop_context.growth_stage,
      latest_crop_context.growth_stage_source,
      latest_crop_context.accumulated_gdd,
      latest_crop_context.last_gdd_observed_on,
      target_signal_set.id as last_weather_signal_set_id,
      latest_crop_context.last_stage_updated_at,
      jsonb_build_object(
        'replaySourceFieldId', latest_crop_context.source_field_id,
        'replaySourceWorkspaceId', latest_crop_context.source_workspace_id,
        'replaySourceWorkspaceSlug', latest_crop_context.source_workspace_slug,
        'replaySourceKey', latest_crop_context.source_crop_context_key
      ) as replay_metadata
    from latest_crop_contexts latest_crop_context
    left join lateral (
      select signal_set.id
      from app.field_weather_signal_sets signal_set
      where signal_set.workspace_id = target_workspace_id
        and signal_set.field_id = latest_crop_context.target_field_id
      order by signal_set.observed_at desc, signal_set.updated_at desc
      limit 1
    ) target_signal_set on true
  ),
  upserted_crop_contexts as (
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
    select
      target_workspace_id,
      crop_context_targets.target_field_id,
      crop_context_targets.season_year,
      crop_context_targets.crop_type,
      crop_context_targets.growth_stage,
      crop_context_targets.growth_stage_source,
      crop_context_targets.accumulated_gdd,
      crop_context_targets.last_gdd_observed_on,
      crop_context_targets.last_weather_signal_set_id,
      crop_context_targets.last_stage_updated_at,
      'field-intake:hydration-replay',
      crop_context_targets.replay_metadata
    from crop_context_targets
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
      metadata = excluded.metadata
    returning field_id
  )
  update pg_temp.replay_batch_results replay_result
  set copied_crop_context = true
  from (select distinct field_id as target_field_id from upserted_crop_contexts) crop_counts
  where replay_result.target_field_id = crop_counts.target_field_id;

  with source_snapshots as (
    select
      source_candidate.target_field_id,
      source_candidate.source_workspace_id,
      source_candidate.source_field_id,
      moisture_snapshot.id as source_snapshot_id,
      moisture_snapshot.observed_at,
      moisture_snapshot.source_key,
      moisture_snapshot.root_zone_pct,
      moisture_snapshot.surface_pct,
      moisture_snapshot.confidence,
      moisture_snapshot.inputs,
      row_number() over (
        partition by source_candidate.target_field_id
        order by moisture_snapshot.observed_at desc, moisture_snapshot.created_at desc
      ) as snapshot_rank
    from pg_temp.replay_batch_source_candidates source_candidate
    join app.field_moisture_snapshots moisture_snapshot
      on moisture_snapshot.workspace_id = source_candidate.source_workspace_id
     and moisture_snapshot.field_id = source_candidate.source_field_id
    where source_candidate.action = 'replayed'
  ),
  selected_snapshots as (
    select *
    from source_snapshots
    where snapshot_rank <= 14
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
      selected_snapshots.target_field_id,
      selected_snapshots.observed_at,
      selected_snapshots.source_key,
      selected_snapshots.root_zone_pct,
      selected_snapshots.surface_pct,
      selected_snapshots.confidence,
      selected_snapshots.inputs
    from selected_snapshots
    order by selected_snapshots.target_field_id, selected_snapshots.observed_at asc
    on conflict (field_id, observed_at, source_key) do update
    set
      root_zone_pct = excluded.root_zone_pct,
      surface_pct = excluded.surface_pct,
      confidence = excluded.confidence,
      inputs = excluded.inputs
    returning field_id
  ),
  snapshot_counts as (
    select field_id as target_field_id, count(*)::integer as snapshot_count
    from upserted_snapshots
    group by field_id
  )
  update pg_temp.replay_batch_results replay_result
  set moisture_snapshot_count = snapshot_counts.snapshot_count
  from snapshot_counts
  where replay_result.target_field_id = snapshot_counts.target_field_id;

  insert into pg_temp.replay_batch_latest_snapshots (
    target_field_id,
    source_workspace_id,
    source_field_id,
    snapshot_id,
    observed_at,
    source_key
  )
  select
    source_snapshot.target_field_id,
    source_snapshot.source_workspace_id,
    source_snapshot.source_field_id,
    source_snapshot.source_snapshot_id,
    source_snapshot.observed_at,
    source_snapshot.source_key
  from source_snapshots source_snapshot
  where source_snapshot.snapshot_rank = 1;

  with target_latest_snapshots as (
    select
      latest_snapshot.target_field_id,
      target_snapshot.id as target_snapshot_id,
      latest_snapshot.snapshot_id as source_snapshot_id,
      latest_snapshot.observed_at,
      latest_snapshot.source_key
    from pg_temp.replay_batch_latest_snapshots latest_snapshot
    join app.field_moisture_snapshots target_snapshot
      on target_snapshot.workspace_id = target_workspace_id
     and target_snapshot.field_id = latest_snapshot.target_field_id
     and target_snapshot.observed_at = latest_snapshot.observed_at
     and target_snapshot.source_key = latest_snapshot.source_key
  ),
  deleted_target_cells as (
    delete from app.field_moisture_cell_snapshots target_cell
    using target_latest_snapshots target_snapshot
    where target_cell.workspace_id = target_workspace_id
      and target_cell.field_id = target_snapshot.target_field_id
      and target_cell.snapshot_id = target_snapshot.target_snapshot_id
    returning target_cell.field_id
  ),
  inserted_cells as (
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
      target_snapshot.target_field_id,
      target_snapshot.target_snapshot_id,
      target_snapshot.observed_at,
      target_snapshot.source_key,
      source_cell.cell_key,
      source_cell.row_index,
      source_cell.column_index,
      source_cell.centroid,
      source_cell.boundary,
      source_cell.root_zone_pct,
      source_cell.surface_pct,
      source_cell.confidence
    from target_latest_snapshots target_snapshot
    join app.field_moisture_cell_snapshots source_cell
      on source_cell.snapshot_id = target_snapshot.source_snapshot_id
    returning field_id
  ),
  cell_counts as (
    select field_id as target_field_id, count(*)::integer as cell_count
    from inserted_cells
    group by field_id
  )
  update pg_temp.replay_batch_results replay_result
  set moisture_cell_count = cell_counts.cell_count
  from cell_counts
  where replay_result.target_field_id = cell_counts.target_field_id;

  insert into pg_temp.replay_batch_latest_rasters (
    target_field_id,
    source_workspace_id,
    source_field_id,
    observation_id,
    observed_at,
    source_key,
    provider_key,
    artifact_key,
    metadata
  )
  select distinct on (source_candidate.target_field_id)
    source_candidate.target_field_id,
    source_candidate.source_workspace_id,
    source_candidate.source_field_id,
    raster_observation.id,
    raster_observation.observed_at,
    raster_observation.source_key,
    raster_observation.provider_key,
    raster_observation.artifact_key,
    raster_observation.metadata
  from pg_temp.replay_batch_source_candidates source_candidate
  join app.field_raster_observations raster_observation
    on raster_observation.workspace_id = source_candidate.source_workspace_id
   and raster_observation.field_id = source_candidate.source_field_id
  where source_candidate.action = 'replayed'
  order by
    source_candidate.target_field_id,
    case
      when raster_observation.metadata ->> 'mode' = 'synthetic-seeded' then 0
      when raster_observation.metadata ->> 'materializationMode' = 'provider'
        or raster_observation.source_key not like 'synthetic-%' then 3
      when raster_observation.metadata ->> 'materializationMode' in ('synthetic', 'synthetic-fallback') then 2
      else 1
    end desc,
    raster_observation.observed_at desc,
    raster_observation.created_at desc;

  delete from app.field_raster_observations target_raster
  using pg_temp.replay_batch_latest_rasters latest_raster
  where target_raster.workspace_id = target_workspace_id
    and target_raster.field_id = latest_raster.target_field_id
    and target_raster.source_key = latest_raster.source_key
    and target_raster.observed_at = latest_raster.observed_at;

  with inserted_rasters as (
    insert into app.field_raster_observations (
      workspace_id,
      field_id,
      observed_at,
      source_key,
      provider_key,
      artifact_key,
      metadata
    )
    select
      target_workspace_id,
      latest_raster.target_field_id,
      latest_raster.observed_at,
      latest_raster.source_key,
      latest_raster.provider_key,
      latest_raster.artifact_key,
      latest_raster.metadata
    from pg_temp.replay_batch_latest_rasters latest_raster
    returning field_id
  )
  update pg_temp.replay_batch_results replay_result
  set raster_observation = true
  from (select distinct field_id as target_field_id from inserted_rasters) raster_counts
  where replay_result.target_field_id = raster_counts.target_field_id;

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
    target_raster.id,
    target_workspace_id,
    latest_raster.target_field_id,
    latest_raster.observed_at,
    latest_raster.source_key,
    latest_raster.provider_key,
    source_cell.cell_key,
    source_cell.row_index,
    source_cell.column_index,
    source_cell.centroid,
    source_cell.boundary,
    source_cell.measurements
  from pg_temp.replay_batch_latest_rasters latest_raster
  join app.field_raster_observations target_raster
    on target_raster.workspace_id = target_workspace_id
   and target_raster.field_id = latest_raster.target_field_id
   and target_raster.source_key = latest_raster.source_key
   and target_raster.observed_at = latest_raster.observed_at
  join app.field_raster_observation_cells source_cell
    on source_cell.observation_id = latest_raster.observation_id;

  return query
  select
    replay_result.target_field_id,
    replay_result.action,
    replay_result.reason,
    replay_result.source_field_id,
    replay_result.source_workspace_id,
    replay_result.source_workspace_slug,
    replay_result.copied_crop_context,
    replay_result.weather_observation_count,
    replay_result.weather_forecast_count,
    replay_result.weather_signal_set,
    replay_result.moisture_snapshot_count,
    replay_result.moisture_cell_count,
    replay_result.raster_observation
  from pg_temp.replay_batch_results replay_result
  order by replay_result.target_field_id;
end;
$$;
