create table if not exists app.workspace_email_provisions (
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  email text not null,
  role app.workspace_role not null,
  created_by uuid,
  created_at timestamptz not null default timezone('utc', now()),
  claimed_by uuid,
  claimed_at timestamptz,
  primary key (workspace_id, email),
  constraint workspace_email_provisions_email_lowercase check (
    email = lower(email)
  )
);

create index if not exists workspace_email_provisions_lookup_idx
  on app.workspace_email_provisions (email, claimed_at, workspace_id);

alter table app.workspace_email_provisions enable row level security;

create policy workspace_email_provisions_select_manager
  on app.workspace_email_provisions
  for select
  to authenticated
  using (
    auth.uid() is not null
    and app.can_manage_workspace(workspace_id)
  );

create policy workspace_email_provisions_insert_manager
  on app.workspace_email_provisions
  for insert
  to authenticated
  with check (
    auth.uid() is not null
    and app.can_manage_workspace(workspace_id)
  );

create policy workspace_email_provisions_update_manager
  on app.workspace_email_provisions
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

create policy workspace_email_provisions_delete_manager
  on app.workspace_email_provisions
  for delete
  to authenticated
  using (
    auth.uid() is not null
    and app.can_manage_workspace(workspace_id)
  );
