drop function if exists app.claim_next_job_dispatch(text);

create or replace function app.claim_next_job_dispatch(
  worker_name text,
  stale_after_seconds integer
)
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
    where (
      dispatch.status = 'queued'
      and dispatch.available_at <= timezone('utc', now())
    ) or (
      dispatch.status = 'running'
      and dispatch.locked_at is not null
      and dispatch.locked_at <= timezone('utc', now()) - make_interval(secs => stale_after_seconds)
    )
    order by
      case when dispatch.status = 'queued' then 0 else 1 end,
      dispatch.available_at asc,
      dispatch.created_at asc
    limit 1
    for update skip locked
  )
  update app.job_dispatches dispatch
  set
    status = 'running',
    available_at = timezone('utc', now()),
    locked_at = timezone('utc', now()),
    locked_by = worker_name,
    completed_at = null,
    failed_at = null,
    result = null,
    attempts = dispatch.attempts + 1
  from next_job
  where dispatch.id = next_job.id
  returning dispatch.* into claimed_dispatch;

  return claimed_dispatch;
end;
$$;

grant execute on function app.claim_next_job_dispatch(text, integer) to service_role;
