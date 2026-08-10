-- Run this in the Supabase SQL editor before wiring in LIFF authentication.
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(), line_user_id text unique,
  display_name text, created_at timestamptz not null default now()
);
create table if not exists public.study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  exam_date date not null, daily_hours numeric(3,1) not null check (daily_hours > 0),
  weak_subject text not null, goal text, created_at timestamptz not null default now()
);
create table if not exists public.daily_tasks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.study_plans(id) on delete cascade,
  task_date date not null, subject text not null, minutes integer not null check (minutes > 0),
  task_type text not null, sort_order integer not null default 0
);
create table if not exists public.task_completions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.daily_tasks(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  completed_at timestamptz not null default now(), unique(task_id, user_id)
);
create table if not exists public.energy (
  user_id uuid primary key references public.users(id) on delete cascade,
  current_energy integer not null default 0 check (current_energy between 0 and 100),
  prayer_planks integer not null default 0 check (prayer_planks >= 0),
  updated_at timestamptz not null default now()
);
