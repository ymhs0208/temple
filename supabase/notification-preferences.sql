create table if not exists public.user_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  notifications_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.user_preferences enable row level security;
