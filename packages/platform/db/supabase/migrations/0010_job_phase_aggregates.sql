create or replace view app.job_phase_timing_summary
with (security_invoker = true)
as
select
  dispatch.job_key,
  phase.phase_key,
  phase.phase_label,
  count(*)::bigint as run_count,
  count(*) filter (where phase.status = 'running')::bigint as running_count,
  count(*) filter (where phase.status = 'completed')::bigint as completed_count,
  count(*) filter (where phase.status = 'cancelled')::bigint as cancelled_count,
  count(*) filter (where phase.status = 'failed')::bigint as failed_count,
  count(*) filter (where phase.status = 'interrupted')::bigint as interrupted_count,
  avg(phase.duration_ms)::numeric as average_duration_ms,
  min(phase.duration_ms) as min_duration_ms,
  max(phase.duration_ms) as max_duration_ms,
  max(phase.ended_at) as latest_ended_at,
  max(phase.updated_at) as latest_updated_at
from app.job_dispatch_phase_runs phase
join app.job_dispatches dispatch on dispatch.id = phase.dispatch_id
group by dispatch.job_key, phase.phase_key, phase.phase_label;

grant select on app.job_phase_timing_summary to authenticated, service_role;

create or replace view app.job_attempt_timeline
with (security_invoker = true)
as
select
  phase.dispatch_id,
  dispatch.job_key,
  phase.attempt,
  case
    when count(*) filter (where phase.status = 'running') > 0 then 'running'::text
    when count(*) filter (where phase.status = 'cancelled') > 0 then 'cancelled'::text
    when count(*) filter (where phase.status = 'failed') > 0 then 'failed'::text
    when count(*) filter (where phase.status = 'interrupted') > 0 then 'interrupted'::text
    else 'completed'::text
  end as attempt_status,
  min(phase.started_at) as attempt_started_at,
  max(coalesce(phase.ended_at, phase.updated_at)) as attempt_ended_at,
  count(*)::bigint as phase_run_count,
  count(*) filter (where phase.status = 'running')::bigint as running_phase_count,
  count(*) filter (where phase.status = 'completed')::bigint as completed_phase_count,
  count(*) filter (where phase.status = 'cancelled')::bigint as cancelled_phase_count,
  count(*) filter (where phase.status = 'failed')::bigint as failed_phase_count,
  count(*) filter (where phase.status = 'interrupted')::bigint as interrupted_phase_count,
  sum(phase.duration_ms)::bigint as total_phase_duration_ms,
  max(phase.updated_at) as latest_phase_updated_at
from app.job_dispatch_phase_runs phase
join app.job_dispatches dispatch on dispatch.id = phase.dispatch_id
group by phase.dispatch_id, dispatch.job_key, phase.attempt;

grant select on app.job_attempt_timeline to authenticated, service_role;
