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
language sql
security invoker
set search_path = app, public, extensions
as $$
  with batch_candidates as (
    select
      candidate_row.committed_field_id as target_field_id,
      candidate_row.name as target_field_name,
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
  )
  select
    candidate.target_field_id,
    replay.action,
    replay.reason,
    replay.source_field_id,
    replay.source_workspace_id,
    replay.source_workspace_slug,
    replay.copied_crop_context,
    replay.weather_observation_count,
    replay.weather_forecast_count,
    replay.weather_signal_set,
    replay.moisture_snapshot_count,
    replay.moisture_cell_count,
    replay.raster_observation
  from batch_candidates candidate
  cross join lateral app.replay_field_hydration_from_import_candidate(
    target_workspace_id,
    candidate.target_field_id,
    candidate.target_field_name,
    candidate.target_legal_land_descriptions,
    candidate.target_crop_type
  ) replay;
$$;

grant execute on function app.replay_field_hydration_from_committed_batch(uuid, uuid) to service_role;
