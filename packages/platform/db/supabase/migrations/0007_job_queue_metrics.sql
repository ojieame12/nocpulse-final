create or replace view app.job_dispatch_summary
with (security_invoker = true)
as
select
  dispatch.job_key,
  dispatch.status,
  count(*)::bigint as dispatch_count,
  min(dispatch.created_at) as oldest_created_at,
  max(dispatch.created_at) as latest_created_at,
  max(dispatch.updated_at) as latest_updated_at,
  count(*) filter (
    where dispatch.cancel_requested_at is not null
      and dispatch.cancelled_at is null
  )::bigint as active_cancellation_count
from app.job_dispatches dispatch
group by dispatch.job_key, dispatch.status;

grant select on app.job_dispatch_summary to authenticated, service_role;

create or replace function app.get_job_queue_health(stale_after_seconds integer default 300)
returns table (
  total_count bigint,
  queued_count bigint,
  running_count bigint,
  completed_count bigint,
  failed_count bigint,
  cancelled_count bigint,
  stale_running_count bigint,
  cancellation_requested_count bigint,
  oldest_queued_at timestamptz,
  oldest_running_at timestamptz,
  latest_updated_at timestamptz
)
language sql
stable
security invoker
as $$
  select
    count(*)::bigint as total_count,
    count(*) filter (where dispatch.status = 'queued')::bigint as queued_count,
    count(*) filter (where dispatch.status = 'running')::bigint as running_count,
    count(*) filter (where dispatch.status = 'completed')::bigint as completed_count,
    count(*) filter (where dispatch.status = 'failed')::bigint as failed_count,
    count(*) filter (where dispatch.status = 'cancelled')::bigint as cancelled_count,
    count(*) filter (
      where dispatch.status = 'running'
        and dispatch.locked_at is not null
        and dispatch.locked_at <= now() - make_interval(secs => stale_after_seconds)
    )::bigint as stale_running_count,
    count(*) filter (
      where dispatch.cancel_requested_at is not null
        and dispatch.cancelled_at is null
    )::bigint as cancellation_requested_count,
    min(dispatch.available_at) filter (where dispatch.status = 'queued') as oldest_queued_at,
    min(dispatch.locked_at) filter (where dispatch.status = 'running') as oldest_running_at,
    max(dispatch.updated_at) as latest_updated_at
  from app.job_dispatches dispatch;
$$;

grant execute on function app.get_job_queue_health(integer) to authenticated, service_role;
