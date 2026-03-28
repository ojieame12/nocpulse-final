do $$
begin
  if not exists (
    select 1
    from pg_type type_def
    join pg_namespace namespace_def on namespace_def.oid = type_def.typnamespace
    where namespace_def.nspname = 'app'
      and type_def.typname = 'field_import_batch_status'
  ) then
    create type app.field_import_batch_status as enum ('previewed', 'committed');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type type_def
    join pg_namespace namespace_def on namespace_def.oid = type_def.typnamespace
    where namespace_def.nspname = 'app'
      and type_def.typname = 'field_import_candidate_status'
  ) then
    create type app.field_import_candidate_status as enum ('pending', 'committed');
  end if;
end
$$;

create table if not exists app.field_import_batches (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  source_type text not null,
  file_name text not null,
  sheet_name text not null,
  status app.field_import_batch_status not null default 'previewed',
  row_count integer not null,
  valid_row_count integer not null,
  field_count integer not null,
  issue_count integer not null,
  issues jsonb not null default '[]'::jsonb,
  created_by uuid not null,
  committed_by uuid,
  committed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint field_import_batches_source_type_check check (source_type <> ''),
  constraint field_import_batches_counts_check check (
    row_count >= 0
    and valid_row_count >= 0
    and field_count >= 0
    and issue_count >= 0
  ),
  constraint field_import_batches_issues_array check (
    jsonb_typeof(issues) = 'array'
  )
);

create table if not exists app.field_import_candidates (
  id uuid primary key default extensions.gen_random_uuid(),
  batch_id uuid not null references app.field_import_batches(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  ordinal integer not null,
  name text not null,
  area_ha numeric(12, 2) not null,
  boundary extensions.geometry(MultiPolygon, 4326) not null,
  crop_type text,
  row_count integer not null,
  row_numbers jsonb not null default '[]'::jsonb,
  legal_land_descriptions jsonb not null default '[]'::jsonb,
  split_index integer not null,
  split_count integer not null,
  lld_components_list jsonb not null default '[]'::jsonb,
  status app.field_import_candidate_status not null default 'pending',
  committed_field_id uuid,
  commit_action text,
  committed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint field_import_candidates_area_positive check (area_ha > 0),
  constraint field_import_candidates_row_count_positive check (row_count > 0),
  constraint field_import_candidates_split_check check (
    split_index > 0
    and split_count > 0
    and split_index <= split_count
  ),
  constraint field_import_candidates_json_arrays check (
    jsonb_typeof(row_numbers) = 'array'
    and jsonb_typeof(legal_land_descriptions) = 'array'
    and jsonb_typeof(lld_components_list) = 'array'
  ),
  constraint field_import_candidates_commit_action_check check (
    commit_action is null
    or commit_action in ('created', 'reused')
  ),
  constraint field_import_candidates_unique_batch_ordinal unique (batch_id, ordinal),
  constraint field_import_candidates_committed_field_fk
    foreign key (workspace_id, committed_field_id)
    references app.fields(workspace_id, id)
    on delete set null
);

create index if not exists field_import_batches_workspace_created_idx
  on app.field_import_batches (workspace_id, created_at desc);

create index if not exists field_import_candidates_batch_ordinal_idx
  on app.field_import_candidates (batch_id, ordinal asc);

create index if not exists field_import_candidates_boundary_gix
  on app.field_import_candidates using gist (boundary);

create trigger field_import_batches_set_updated_at
before update on app.field_import_batches
for each row
execute function app.set_updated_at();

create trigger field_import_candidates_set_updated_at
before update on app.field_import_candidates
for each row
execute function app.set_updated_at();

alter table app.field_import_batches enable row level security;
alter table app.field_import_candidates enable row level security;

create policy field_import_batches_select_member
  on app.field_import_batches
  for select
  to authenticated
  using (
    auth.uid() is not null
    and app.is_workspace_member(workspace_id)
  );

create policy field_import_batches_insert_manager
  on app.field_import_batches
  for insert
  to authenticated
  with check (
    auth.uid() is not null
    and app.can_manage_workspace(workspace_id)
  );

create policy field_import_batches_update_manager
  on app.field_import_batches
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

create policy field_import_candidates_select_member
  on app.field_import_candidates
  for select
  to authenticated
  using (
    auth.uid() is not null
    and app.is_workspace_member(workspace_id)
  );

create policy field_import_candidates_insert_manager
  on app.field_import_candidates
  for insert
  to authenticated
  with check (
    auth.uid() is not null
    and app.can_manage_workspace(workspace_id)
  );

create policy field_import_candidates_update_manager
  on app.field_import_candidates
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

create or replace function app.create_field_import_batch(
  target_workspace_id uuid,
  import_source_type text,
  import_file_name text,
  import_sheet_name text,
  import_row_count integer,
  import_valid_row_count integer,
  import_field_count integer,
  import_issue_count integer,
  import_issues jsonb,
  import_candidates jsonb,
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
  inserted_batch app.field_import_batches;
begin
  insert into app.field_import_batches (
    workspace_id,
    source_type,
    file_name,
    sheet_name,
    row_count,
    valid_row_count,
    field_count,
    issue_count,
    issues,
    created_by
  )
  values (
    target_workspace_id,
    import_source_type,
    import_file_name,
    import_sheet_name,
    import_row_count,
    import_valid_row_count,
    import_field_count,
    import_issue_count,
    coalesce(import_issues, '[]'::jsonb),
    actor_user_id
  )
  returning * into inserted_batch;

  insert into app.field_import_candidates (
    batch_id,
    workspace_id,
    ordinal,
    name,
    area_ha,
    boundary,
    crop_type,
    row_count,
    row_numbers,
    legal_land_descriptions,
    split_index,
    split_count,
    lld_components_list
  )
  select
    inserted_batch.id,
    inserted_batch.workspace_id,
    candidate_entry.ordinality::integer,
    candidate_entry.value #>> '{draft,name}',
    (candidate_entry.value #>> '{draft,areaHa}')::numeric,
    extensions.st_setsrid(
      extensions.st_geomfromgeojson((candidate_entry.value #> '{draft,boundary}')::text),
      4326
    )::extensions.geometry(MultiPolygon, 4326),
    nullif(candidate_entry.value ->> 'cropType', ''),
    coalesce((candidate_entry.value ->> 'rowCount')::integer, 0),
    coalesce(candidate_entry.value -> 'rowNumbers', '[]'::jsonb),
    coalesce(candidate_entry.value -> 'legalLandDescriptions', '[]'::jsonb),
    coalesce((candidate_entry.value ->> 'splitIndex')::integer, 1),
    coalesce((candidate_entry.value ->> 'splitCount')::integer, 1),
    coalesce(candidate_entry.value -> 'lldComponentsList', '[]'::jsonb)
  from jsonb_array_elements(coalesce(import_candidates, '[]'::jsonb))
    with ordinality as candidate_entry(value, ordinality);

  return query
  select
    inserted_batch.id,
    inserted_batch.workspace_id,
    inserted_batch.source_type,
    inserted_batch.file_name,
    inserted_batch.sheet_name,
    inserted_batch.status,
    inserted_batch.row_count,
    inserted_batch.valid_row_count,
    inserted_batch.field_count,
    inserted_batch.issue_count,
    inserted_batch.issues,
    inserted_batch.created_by,
    inserted_batch.committed_by,
    inserted_batch.committed_at,
    inserted_batch.created_at,
    inserted_batch.updated_at;
end;
$$;

create or replace function app.get_field_import_batch_detail(
  target_workspace_id uuid,
  target_batch_id uuid
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
language sql
security invoker
set search_path = app, public, extensions
as $$
  select
    batch_row.id,
    batch_row.workspace_id,
    batch_row.source_type,
    batch_row.file_name,
    batch_row.sheet_name,
    batch_row.status,
    batch_row.row_count,
    batch_row.valid_row_count,
    batch_row.field_count,
    batch_row.issue_count,
    batch_row.issues,
    batch_row.created_by,
    batch_row.committed_by,
    batch_row.committed_at,
    batch_row.created_at,
    batch_row.updated_at
  from app.field_import_batches batch_row
  where batch_row.workspace_id = target_workspace_id
    and batch_row.id = target_batch_id;
$$;

create or replace function app.get_field_import_batch_candidates(
  target_workspace_id uuid,
  target_batch_id uuid
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
language sql
security invoker
set search_path = app, public, extensions
as $$
  select
    candidate_row.id,
    candidate_row.batch_id,
    candidate_row.workspace_id,
    candidate_row.ordinal,
    candidate_row.name,
    candidate_row.area_ha,
    extensions.st_asgeojson(candidate_row.boundary)::jsonb as boundary_geojson,
    candidate_row.crop_type,
    candidate_row.row_count,
    candidate_row.row_numbers,
    candidate_row.legal_land_descriptions,
    candidate_row.split_index,
    candidate_row.split_count,
    candidate_row.lld_components_list,
    candidate_row.status,
    candidate_row.committed_field_id,
    candidate_row.commit_action,
    candidate_row.committed_at,
    candidate_row.created_at,
    candidate_row.updated_at
  from app.field_import_candidates candidate_row
  where candidate_row.workspace_id = target_workspace_id
    and candidate_row.batch_id = target_batch_id
  order by candidate_row.ordinal asc;
$$;

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
  update app.field_import_candidates
  set
    status = 'committed',
    committed_field_id = target_field_id,
    commit_action = target_commit_action,
    committed_at = timezone('utc', now())
  where workspace_id = target_workspace_id
    and batch_id = target_batch_id
    and id = target_candidate_id
  returning * into updated_candidate;

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
  update app.field_import_batches
  set
    status = 'committed',
    committed_by = actor_user_id,
    committed_at = timezone('utc', now())
  where workspace_id = target_workspace_id
    and id = target_batch_id
  returning * into updated_batch;

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

grant execute on function app.create_field_import_batch(
  uuid,
  text,
  text,
  text,
  integer,
  integer,
  integer,
  integer,
  jsonb,
  jsonb,
  uuid
) to authenticated, service_role;

grant execute on function app.get_field_import_batch_detail(uuid, uuid)
  to authenticated, service_role;

grant execute on function app.get_field_import_batch_candidates(uuid, uuid)
  to authenticated, service_role;

grant execute on function app.mark_field_import_candidate_committed(
  uuid,
  uuid,
  uuid,
  uuid,
  text
) to authenticated, service_role;

grant execute on function app.mark_field_import_batch_committed(uuid, uuid, uuid)
  to authenticated, service_role;
