create table if not exists app.workspace_share_tokens (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  field_id uuid not null references app.fields(id) on delete cascade,
  token_hash text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_accessed_at timestamptz
);

create index if not exists workspace_share_tokens_workspace_idx
  on app.workspace_share_tokens (workspace_id, created_at desc);

create index if not exists workspace_share_tokens_field_idx
  on app.workspace_share_tokens (field_id, created_at desc);
