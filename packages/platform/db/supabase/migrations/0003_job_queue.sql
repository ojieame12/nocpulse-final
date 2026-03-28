do $$
begin
  if not exists (
    select 1
    from pg_type type_def
    join pg_namespace namespace_def on namespace_def.oid = type_def.typnamespace
    where namespace_def.nspname = 'app'
      and type_def.typname = 'job_dispatch_status'
  ) then
    create type app.job_dispatch_status as enum (
      'queued',
      'running',
      'completed',
      'failed'
    );
  end if;
end
$$;

create table if not exists app.job_dispatches (
  id uuid primary key default extensions.gen_random_uuid(),
  job_key text not null,
  payload jsonb not null default '{}'::jsonb,
  status app.job_dispatch_status not null default 'queued',
  attempts integer not null default 0,
  available_at timestamptz not null default timezone('utc', now()),
  locked_at timestamptz,
  locked_by text,
  completed_at timestamptz,
  failed_at timestamptz,
  result jsonb,
  last_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint job_dispatches_payload_object check (
    jsonb_typeof(payload) = 'object'
  )
);

create index if not exists job_dispatches_queue_idx
  on app.job_dispatches (status, available_at, created_at);

create index if not exists job_dispatches_job_key_idx
  on app.job_dispatches (job_key, status, created_at desc);

create trigger job_dispatches_set_updated_at
before update on app.job_dispatches
for each row
execute function app.set_updated_at();

create or replace function app.claim_next_job_dispatch(worker_name text)
returns app.job_dispatches
language plpgsql
security invoker
set search_path = app, public, extensions
as $$
declare
  claimed_dispatch app.job_dispatches;
begin
  with next_job as (
    select dispatch.id
    from app.job_dispatches dispatch
    where dispatch.status = 'queued'
      and dispatch.available_at <= timezone('utc', now())
    order by dispatch.available_at asc, dispatch.created_at asc
    limit 1
    for update skip locked
  )
  update app.job_dispatches dispatch
  set
    status = 'running',
    locked_at = timezone('utc', now()),
    locked_by = worker_name,
    attempts = dispatch.attempts + 1
  from next_job
  where dispatch.id = next_job.id
  returning dispatch.* into claimed_dispatch;

  return claimed_dispatch;
end;
$$;

grant execute on function app.claim_next_job_dispatch(text) to service_role;
