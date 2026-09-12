create table if not exists public.user_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  notifications_enabled boolean not null default true,
  morning_time time not null default '08:00',
  evening_time time not null default '20:30',
  timezone text not null default 'Asia/Taipei',
  updated_at timestamptz not null default now()
);
alter table public.user_preferences add column if not exists morning_time time not null default '08:00';
alter table public.user_preferences add column if not exists evening_time time not null default '20:30';
alter table public.user_preferences add column if not exists timezone text not null default 'Asia/Taipei';
alter table public.user_preferences enable row level security;
