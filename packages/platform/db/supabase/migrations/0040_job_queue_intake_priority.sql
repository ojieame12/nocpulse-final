create or replace function app.claim_next_job_dispatch(
  worker_name text,
  stale_after_seconds integer,
  job_keys text[] default null
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
      (
        dispatch.status = 'queued'
        and dispatch.available_at <= timezone('utc', now())
      ) or (
        dispatch.status = 'running'
        and dispatch.locked_at is not null
        and dispatch.locked_at <= timezone('utc', now()) - make_interval(secs => stale_after_seconds)
      )
    )
      and (
        job_keys is null
        or dispatch.job_key = any(job_keys)
      )
    order by
      case dispatch.job_key
        when 'field.bootstrap-initial' then 0
        when 'field.refresh-intake' then 1
        else 100
      end,
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
    attempt_started_at = timezone('utc', now()),
    last_heartbeat_at = timezone('utc', now()),
    active_phase_key = null,
    active_phase_label = null,
    active_phase_started_at = null,
    last_attempt_duration_ms = null,
    completed_at = null,
    failed_at = null,
    cancelled_at = null,
    result = null,
    last_error = null,
    progress_pct = null,
    progress_message = null,
    progress_updated_at = null,
    attempts = dispatch.attempts + 1
  from next_job
  where dispatch.id = next_job.id
  returning dispatch.* into claimed_dispatch;

  return claimed_dispatch;
end;
$$;

grant execute on function app.claim_next_job_dispatch(text, integer, text[]) to service_role;
