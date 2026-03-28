create or replace function app.mark_field_import_candidate_committed(
  target_workspace_id uuid,
  target_batch_id uuid,
  target_candidate_id uuid,
  target_field_id uuid,
  target_commit_action text
)
returns table (
  id uuid,
  batch_id uuid,
  workspace_id uuid,
  ordinal integer,
  name text,
  area_ha numeric,
  boundary_geojson jsonb,
  crop_type text,
  row_count integer,
  row_numbers jsonb,
  legal_land_descriptions jsonb,
  split_index integer,
  split_count integer,
  lld_components_list jsonb,
  status app.field_import_candidate_status,
  committed_field_id uuid,
  commit_action text,
  committed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security invoker
set search_path = app, public, extensions
as $$
declare
  updated_candidate app.field_import_candidates;
begin
  update app.field_import_candidates as candidate_row
  set
    status = 'committed',
    committed_field_id = target_field_id,
    commit_action = target_commit_action,
    committed_at = timezone('utc', now())
  where candidate_row.workspace_id = target_workspace_id
    and candidate_row.batch_id = target_batch_id
    and candidate_row.id = target_candidate_id
  returning candidate_row.* into updated_candidate;

  return query
  select
    updated_candidate.id,
    updated_candidate.batch_id,
    updated_candidate.workspace_id,
    updated_candidate.ordinal,
    updated_candidate.name,
    updated_candidate.area_ha,
    extensions.st_asgeojson(updated_candidate.boundary)::jsonb as boundary_geojson,
    updated_candidate.crop_type,
    updated_candidate.row_count,
    updated_candidate.row_numbers,
    updated_candidate.legal_land_descriptions,
    updated_candidate.split_index,
    updated_candidate.split_count,
    updated_candidate.lld_components_list,
    updated_candidate.status,
    updated_candidate.committed_field_id,
    updated_candidate.commit_action,
    updated_candidate.committed_at,
    updated_candidate.created_at,
    updated_candidate.updated_at;
end;
$$;

create or replace function app.mark_field_import_batch_committed(
  target_workspace_id uuid,
  target_batch_id uuid,
  actor_user_id uuid
)
returns table (
  id uuid,
  workspace_id uuid,
  source_type text,
  file_name text,
  sheet_name text,
  status app.field_import_batch_status,
  row_count integer,
  valid_row_count integer,
  field_count integer,
  issue_count integer,
  issues jsonb,
  created_by uuid,
  committed_by uuid,
  committed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security invoker
set search_path = app, public, extensions
as $$
declare
  updated_batch app.field_import_batches;
begin
  update app.field_import_batches as batch_row
  set
    status = 'committed',
    committed_by = actor_user_id,
    committed_at = timezone('utc', now())
  where batch_row.workspace_id = target_workspace_id
    and batch_row.id = target_batch_id
  returning batch_row.* into updated_batch;

  return query
  select
    updated_batch.id,
    updated_batch.workspace_id,
    updated_batch.source_type,
    updated_batch.file_name,
    updated_batch.sheet_name,
    updated_batch.status,
    updated_batch.row_count,
    updated_batch.valid_row_count,
    updated_batch.field_count,
    updated_batch.issue_count,
    updated_batch.issues,
    updated_batch.created_by,
    updated_batch.committed_by,
    updated_batch.committed_at,
    updated_batch.created_at,
    updated_batch.updated_at;
end;
$$;
