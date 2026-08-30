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
alter table public.study_plans add column if not exists challenge_name text;
alter table public.study_plans add column if not exists wishes jsonb not null default '[]'::jsonb;
create unique index if not exists study_plans_one_per_user_idx on public.study_plans (user_id);
create table if not exists public.daily_tasks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.study_plans(id) on delete cascade,
  task_date date not null, subject text not null, minutes integer not null check (minutes > 0),
  task_type text not null, sort_order integer not null default 0
);
create unique index if not exists daily_tasks_one_position_idx on public.daily_tasks (plan_id, task_date, sort_order);
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
-- LIFF 裝置上的祈福、靈籤與回顧狀態，依 LINE 身分保存以支援跨裝置還原。
create table if not exists public.user_companion_states (
  user_id uuid primary key references public.users(id) on delete cascade,
  oracle_tickets integer not null default 0 check (oracle_tickets >= 0),
  oracle_planks_spent integer not null default 0 check (oracle_planks_spent >= 0),
  oracle_result_id integer check (oracle_result_id between 0 and 5),
  daily_fortune_task jsonb not null default '{}'::jsonb,
  focus_reward_minutes integer not null default 0 check (focus_reward_minutes >= 0),
  wish_reflections jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- The browser never accesses these tables directly. The server verifies a LINE ID token,
-- then uses the service-role key for the narrowly scoped sync endpoint.
alter table public.users enable row level security;
alter table public.study_plans enable row level security;
alter table public.daily_tasks enable row level security;
alter table public.task_completions enable row level security;
alter table public.energy enable row level security;
alter table public.user_companion_states enable row level security;

-- The server calls this function with the service-role key. It serializes a
-- user's writes and commits the plan, tasks, completions, and energy together.
create or replace function public.sync_learning_progress(
  p_line_user_id text,
  p_display_name text,
  p_exam_date date,
  p_daily_hours numeric,
  p_weak_subject text,
  p_goal text,
  p_challenge_name text,
  p_wishes jsonb,
  p_task_date date,
  p_tasks jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_plan_id uuid;
  v_completed_count integer;
begin
  if jsonb_typeof(p_tasks) <> 'array' or jsonb_array_length(p_tasks) not between 1 and 5 then
    raise exception 'invalid task list';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_line_user_id));

  insert into users (line_user_id, display_name)
  values (p_line_user_id, p_display_name)
  on conflict (line_user_id) do update set display_name = excluded.display_name
  returning id into v_user_id;

  insert into study_plans (user_id, exam_date, daily_hours, weak_subject, goal, challenge_name, wishes)
  values (v_user_id, p_exam_date, p_daily_hours, p_weak_subject, p_goal, p_challenge_name, coalesce(p_wishes, '[]'::jsonb))
  on conflict (user_id) do update set
    exam_date = excluded.exam_date,
    daily_hours = excluded.daily_hours,
    weak_subject = excluded.weak_subject,
    goal = excluded.goal,
    challenge_name = excluded.challenge_name,
    wishes = excluded.wishes
  returning id into v_plan_id;

  delete from daily_tasks where plan_id = v_plan_id and task_date = p_task_date;
  insert into daily_tasks (plan_id, task_date, subject, minutes, task_type, sort_order)
  select v_plan_id, p_task_date, task.subject, task.minutes, task.detail, task.position - 1
  from jsonb_to_recordset(p_tasks) with ordinality as task(subject text, minutes integer, detail text, done boolean, position bigint)
  where length(trim(task.subject)) > 0 and length(trim(task.detail)) > 0 and task.minutes between 1 and 180;

  if (select count(*) from daily_tasks where plan_id = v_plan_id and task_date = p_task_date) <> jsonb_array_length(p_tasks) then
    raise exception 'invalid task data';
  end if;

  insert into task_completions (task_id, user_id)
  select daily_tasks.id, v_user_id
  from daily_tasks
  join jsonb_to_recordset(p_tasks) with ordinality as task(subject text, minutes integer, detail text, done boolean, position bigint)
    on daily_tasks.sort_order = task.position - 1
  where daily_tasks.plan_id = v_plan_id and daily_tasks.task_date = p_task_date and coalesce(task.done, false)
  on conflict (task_id, user_id) do nothing;

  select count(*) into v_completed_count
  from task_completions
  join daily_tasks on daily_tasks.id = task_completions.task_id
  where task_completions.user_id = v_user_id and daily_tasks.plan_id = v_plan_id and daily_tasks.task_date = p_task_date;

  insert into energy (user_id, current_energy, prayer_planks, updated_at)
  values (v_user_id, least(100, 42 + v_completed_count * 10), 10 + v_completed_count, now())
  on conflict (user_id) do update set
    current_energy = excluded.current_energy,
    prayer_planks = excluded.prayer_planks,
    updated_at = excluded.updated_at;
end;
$$;
revoke all on function public.sync_learning_progress(text, text, date, numeric, text, text, text, jsonb, date, jsonb) from public;
grant execute on function public.sync_learning_progress(text, text, date, numeric, text, text, text, jsonb, date, jsonb) to service_role;

create table if not exists public.temple_visits (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.users(id) on delete cascade,
  temple_code text not null, visited_at timestamptz not null default now(), unique(user_id, temple_code)
);

alter table public.user_companion_states add column if not exists pilgrimage_state jsonb not null default '{}'::jsonb;
alter table public.temple_visits enable row level security;
