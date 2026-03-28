create or replace view app.job_attempt_timing_summary
with (security_invoker = true)
as
select
  timeline.job_key,
  timeline.attempt_status,
  count(*)::bigint as run_count,
  avg(timeline.total_phase_duration_ms)::numeric as average_duration_ms,
  min(timeline.total_phase_duration_ms) as min_duration_ms,
  max(timeline.total_phase_duration_ms) as max_duration_ms,
  max(timeline.attempt_ended_at) as latest_ended_at,
  max(timeline.latest_phase_updated_at) as latest_updated_at
from app.job_attempt_timeline timeline
group by timeline.job_key, timeline.attempt_status;

grant select on app.job_attempt_timing_summary to authenticated, service_role;
