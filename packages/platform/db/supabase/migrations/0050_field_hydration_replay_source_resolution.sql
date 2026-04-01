create or replace function app.replay_field_hydration_from_import_candidate(
  target_workspace_id uuid,
  target_field_id uuid,
  target_field_name text,
  target_legal_land_descriptions text[] default null,
  target_crop_type text default null
)
returns table (
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
declare
  normalized_field_name text;
  candidate_count integer := 0;
  external_candidate_count integer := 0;
  best_source record;
  replay_counts record;
begin
  action := 'skipped';
  reason := null;
  source_field_id := null;
  source_workspace_id := null;
  source_workspace_slug := null;
  copied_crop_context := false;
  weather_observation_count := 0;
  weather_forecast_count := 0;
  weather_signal_set := false;
  moisture_snapshot_count := 0;
  moisture_cell_count := 0;
  raster_observation := false;

  normalized_field_name := nullif(btrim(target_field_name), '');

  if coalesce(array_length(target_legal_land_descriptions, 1), 0) = 0
    and normalized_field_name is null then
    reason := 'missing-stable-key';
    return next;
    return;
  end if;

  with matched_candidates as (
    select distinct
      f.id
    from app.fields f
    where (
      coalesce(array_length(target_legal_land_descriptions, 1), 0) > 0
      and f.legal_land_description = any(target_legal_land_descriptions)
    ) or (
      normalized_field_name is not null
      and lower(btrim(f.name)) = lower(normalized_field_name)
    )
  )
  select count(*)::integer
  into candidate_count
  from matched_candidates;

  if candidate_count = 0 then
    reason := 'no-source-field';
    return next;
    return;
  end if;

  with matched_candidates as (
    select distinct
      f.id,
      f.workspace_id
    from app.fields f
    where (
      coalesce(array_length(target_legal_land_descriptions, 1), 0) > 0
      and f.legal_land_description = any(target_legal_land_descriptions)
    ) or (
      normalized_field_name is not null
      and lower(btrim(f.name)) = lower(normalized_field_name)
    )
  )
  select count(*)::integer
  into external_candidate_count
  from matched_candidates
  where workspace_id <> target_workspace_id;

  if external_candidate_count = 0 then
    reason := 'target-workspace-only';
    return next;
    return;
  end if;

  with ranked_candidates as (
    select
      f.id,
      f.workspace_id,
      w.slug as workspace_slug,
      (
        coalesce(array_length(target_legal_land_descriptions, 1), 0) > 0
        and f.legal_land_description = any(target_legal_land_descriptions)
      ) as lld_matched,
      (
        normalized_field_name is not null
        and lower(btrim(f.name)) = lower(normalized_field_name)
      ) as name_matched,
      exists(
        select 1
        from app.field_crop_contexts c
        where c.workspace_id = f.workspace_id
          and c.field_id = f.id
      ) as has_crop_context,
      exists(
        select 1
        from app.field_weather_observations o
        where o.workspace_id = f.workspace_id
          and o.field_id = f.id
      ) as has_weather_observations,
      exists(
        select 1
        from app.field_weather_signal_sets s
        where s.workspace_id = f.workspace_id
          and s.field_id = f.id
      ) as has_weather_signal_set,
      exists(
        select 1
        from app.field_weather_forecasts forecast
        where forecast.workspace_id = f.workspace_id
          and forecast.field_id = f.id
      ) as has_weather_forecasts,
      exists(
        select 1
        from app.field_moisture_snapshots snapshot
        where snapshot.workspace_id = f.workspace_id
          and snapshot.field_id = f.id
      ) as has_moisture_snapshots,
      exists(
        select 1
        from app.field_moisture_cell_snapshots cell
        where cell.workspace_id = f.workspace_id
          and cell.field_id = f.id
      ) as has_moisture_cells,
      exists(
        select 1
        from app.field_raster_observations raster
        where raster.workspace_id = f.workspace_id
          and raster.field_id = f.id
      ) as has_raster_observation
    from app.fields f
    join app.workspaces w
      on w.id = f.workspace_id
    where f.workspace_id <> target_workspace_id
      and (
        (
          coalesce(array_length(target_legal_land_descriptions, 1), 0) > 0
          and f.legal_land_description = any(target_legal_land_descriptions)
        ) or (
          normalized_field_name is not null
          and lower(btrim(f.name)) = lower(normalized_field_name)
        )
      )
  ),
  scored_candidates as (
    select
      *,
      (
        has_crop_context::integer +
        has_weather_observations::integer +
        has_weather_signal_set::integer +
        has_weather_forecasts::integer +
        has_moisture_snapshots::integer +
        has_moisture_cells::integer +
        has_raster_observation::integer
      ) as score,
      (
        has_weather_observations
        or has_moisture_snapshots
        or has_raster_observation
      ) as hydrated
    from ranked_candidates
  )
  select *
  into best_source
  from scored_candidates
  order by
    hydrated desc,
    score desc,
    lld_matched desc,
    name_matched desc,
    (workspace_slug = 'hope-creek-farms') desc,
    id asc
  limit 1;

  if not found then
    reason := 'no-source-field';
    return next;
    return;
  end if;

  if not best_source.hydrated then
    reason := 'no-hydrated-source';
    source_field_id := best_source.id;
    source_workspace_id := best_source.workspace_id;
    source_workspace_slug := best_source.workspace_slug;
    return next;
    return;
  end if;

  select *
  into replay_counts
  from app.replay_field_hydration_from_source(
    best_source.id,
    target_workspace_id,
    target_field_id,
    target_crop_type
  );

  action := 'replayed';
  source_field_id := best_source.id;
  source_workspace_id := best_source.workspace_id;
  source_workspace_slug := best_source.workspace_slug;
  copied_crop_context := coalesce(replay_counts.copied_crop_context, false);
  weather_observation_count := coalesce(replay_counts.weather_observation_count, 0);
  weather_forecast_count := coalesce(replay_counts.weather_forecast_count, 0);
  weather_signal_set := coalesce(replay_counts.weather_signal_set, false);
  moisture_snapshot_count := coalesce(replay_counts.moisture_snapshot_count, 0);
  moisture_cell_count := coalesce(replay_counts.moisture_cell_count, 0);
  raster_observation := coalesce(replay_counts.raster_observation, false);

  return next;
end;
$$;

grant execute on function app.replay_field_hydration_from_import_candidate(uuid, uuid, text, text[], text) to service_role;
