create table if not exists app.request_access_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  farm_name text not null,
  acreage text,
  message text,
  status text not null default 'new',
  created_at timestamptz not null default timezone('utc', now()),
  constraint request_access_requests_email_lowercase check (
    email = lower(email)
  ),
  constraint request_access_requests_status_check check (
    status in ('new', 'reviewed', 'contacted', 'archived')
  )
);

create index if not exists request_access_requests_email_created_at_idx
  on app.request_access_requests (email, created_at desc);

alter table app.request_access_requests enable row level security;
