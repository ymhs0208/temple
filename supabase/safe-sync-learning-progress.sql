-- Safe sync migration. Run this once after deploying the app.
-- It merges today's submitted tasks and preserves rows created by LINE or
-- another device. It intentionally has the same function signature so the
-- existing API can switch without a client-side migration.
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
language plpgsql security definer set search_path = public
as $$
declare
  v_user_id uuid;
  v_plan_id uuid;
  v_completed_count integer;
  v_task record;
  v_existing_id uuid;
  v_next_order integer;
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

  for v_task in
    select id as task_id, subject, minutes, detail, done, position
    from jsonb_to_recordset(p_tasks) with ordinality as task(id text, subject text, minutes integer, detail text, done boolean, position bigint)
  loop
    if length(trim(v_task.subject)) = 0 or v_task.minutes is null or v_task.minutes not between 1 and 180 then
      raise exception 'invalid task data';
    end if;
    v_existing_id := null;
    if v_task.task_id is not null and v_task.task_id ~* '^[0-9a-f-]{36}$' then
      select id into v_existing_id from daily_tasks where id = v_task.task_id::uuid and plan_id = v_plan_id and task_date = p_task_date;
    end if;
    if v_existing_id is null then
      select id into v_existing_id from daily_tasks where plan_id = v_plan_id and task_date = p_task_date and sort_order = v_task.position - 1;
    end if;
    if v_existing_id is null then
      select coalesce(max(sort_order), -1) + 1 into v_next_order from daily_tasks where plan_id = v_plan_id and task_date = p_task_date;
      insert into daily_tasks (plan_id, task_date, subject, minutes, task_type, sort_order)
      values (v_plan_id, p_task_date, trim(v_task.subject), v_task.minutes, coalesce(nullif(trim(v_task.detail), ''), '自主學習'), v_next_order)
      returning id into v_existing_id;
    else
      update daily_tasks set subject = trim(v_task.subject), minutes = v_task.minutes, task_type = coalesce(nullif(trim(v_task.detail), ''), '自主學習') where id = v_existing_id;
    end if;
    if coalesce(v_task.done, false) then
      insert into task_completions (task_id, user_id) values (v_existing_id, v_user_id) on conflict (task_id, user_id) do nothing;
    end if;
  end loop;

  select count(*) into v_completed_count
  from task_completions join daily_tasks on daily_tasks.id = task_completions.task_id
  where task_completions.user_id = v_user_id and daily_tasks.plan_id = v_plan_id and daily_tasks.task_date = p_task_date;

  insert into energy (user_id, current_energy, prayer_planks, updated_at)
  values (v_user_id, least(100, 42 + v_completed_count * 10), 10 + v_completed_count, now())
  on conflict (user_id) do update set
    current_energy = greatest(energy.current_energy, excluded.current_energy),
    prayer_planks = greatest(energy.prayer_planks, excluded.prayer_planks),
    updated_at = excluded.updated_at;
end;
$$;
revoke all on function public.sync_learning_progress(text, text, date, numeric, text, text, text, jsonb, date, jsonb) from public;
grant execute on function public.sync_learning_progress(text, text, date, numeric, text, text, text, jsonb, date, jsonb) to service_role;
