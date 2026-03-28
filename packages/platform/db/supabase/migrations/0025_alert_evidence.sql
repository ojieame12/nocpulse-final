alter table app.field_alerts
  add column if not exists evidence jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'field_alerts_evidence_object'
  ) then
    alter table app.field_alerts
      add constraint field_alerts_evidence_object
      check (jsonb_typeof(evidence) = 'object');
  end if;
end
$$;
