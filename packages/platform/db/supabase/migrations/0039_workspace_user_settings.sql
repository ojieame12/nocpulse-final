create table if not exists app.workspace_user_settings (
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  user_id uuid not null,
  email_alerts boolean not null default true,
  health_warnings boolean not null default true,
  spray_windows boolean not null default false,
  weekly_digest boolean not null default true,
  units text not null default 'metric',
  temperature_unit text not null default 'celsius',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (workspace_id, user_id),
  constraint workspace_user_settings_units_check check (
    units in ('metric', 'imperial')
  ),
  constraint workspace_user_settings_temperature_unit_check check (
    temperature_unit in ('celsius', 'fahrenheit')
  )
);

create index if not exists workspace_user_settings_user_idx
  on app.workspace_user_settings (user_id, workspace_id);
