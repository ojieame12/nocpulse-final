do $$
begin
  create type app.job_phase_run_status as enum (
    'running',
    'completed',
    'failed',
    'cancelled',
    'interrupted'
  );
exception
  when duplicate_object then null;
end
$$;

create table if not exists app.job_dispatch_phase_runs (
  id uuid primary key default gen_random_uuid(),
  dispatch_id uuid not null references app.job_dispatches(id) on delete cascade,
  attempt integer not null,
  phase_key text not null,
  phase_label text not null,
  status app.job_phase_run_status not null default 'running',
  worker_name text,
  started_at timestamptz not null default timezone('utc', now()),
  ended_at timestamptz,
  duration_ms integer,
  latest_progress_pct integer,
  latest_progress_message text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (dispatch_id, attempt, phase_key)
);

create index if not exists job_dispatch_phase_runs_dispatch_idx
  on app.job_dispatch_phase_runs (dispatch_id, attempt, started_at);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'job_dispatch_phase_runs_duration_ms_nonnegative'
  ) then
    alter table app.job_dispatch_phase_runs
      add constraint job_dispatch_phase_runs_duration_ms_nonnegative
      check (
        duration_ms is null
        or duration_ms >= 0
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'job_dispatch_phase_runs_progress_pct_range'
  ) then
    alter table app.job_dispatch_phase_runs
      add constraint job_dispatch_phase_runs_progress_pct_range
      check (
        latest_progress_pct is null
        or (latest_progress_pct >= 0 and latest_progress_pct <= 100)
      );
  end if;
end
$$;

grant select, insert, update, delete on app.job_dispatch_phase_runs to authenticated, service_role;
