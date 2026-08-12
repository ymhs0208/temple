-- One-time setup for LINE OA automatic reminders.
-- Before enabling this job, store the LINE OA access token in Supabase Vault:
-- select vault.create_secret('YOUR_LINE_CHANNEL_ACCESS_TOKEN', 'line_messaging_access_token');

create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.line_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  reminder_kind text not null check (reminder_kind in ('morning', 'evening')),
  scheduled_for date not null,
  created_at timestamptz not null default now(),
  unique (user_id, reminder_kind, scheduled_for)
);

alter table public.line_notification_deliveries enable row level security;

create or replace function public.dispatch_line_reminders()
returns void
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  access_token text;
  reminder record;
  message_text text;
begin
  select decrypted_secret into access_token
  from vault.decrypted_secrets
  where name = 'line_messaging_access_token'
  limit 1;

  if access_token is null then
    raise notice 'LINE access token has not been stored in Supabase Vault.';
    return;
  end if;

  for reminder in
    select u.id as user_id, u.line_user_id, due.reminder_kind,
           (now() at time zone coalesce(p.timezone, 'Asia/Taipei'))::date as scheduled_for
    from public.user_preferences p
    join public.users u on u.id = p.user_id
    cross join lateral (
      select 'morning'::text as reminder_kind
      where p.morning_time::time(0) = (now() at time zone coalesce(p.timezone, 'Asia/Taipei'))::time(0)
      union all
      select 'evening'::text
      where p.evening_time::time(0) = (now() at time zone coalesce(p.timezone, 'Asia/Taipei'))::time(0)
    ) due
    where p.notifications_enabled = true and u.line_user_id is not null
  loop
    insert into public.line_notification_deliveries (user_id, reminder_kind, scheduled_for)
    values (reminder.user_id, reminder.reminder_kind, reminder.scheduled_for)
    on conflict (user_id, reminder_kind, scheduled_for) do nothing;

    if found then
      message_text := case reminder.reminder_kind
        when 'morning' then '🌅 早安！今天先完成一個小任務，讓目標更靠近。'
        else '🌙 晚安前看一下今天的任務；只要專注 15 分鐘，也算前進。'
      end;

      perform net.http_post(
        url := 'https://api.line.me/v2/bot/message/push',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || access_token
        ),
        body := jsonb_build_object(
          'to', reminder.line_user_id,
          'messages', jsonb_build_array(jsonb_build_object('type', 'text', 'text', message_text))
        )
      );
    end if;
  end loop;
end;
$$;

select cron.unschedule(jobid)
from cron.job
where jobname = 'line-reminders-every-minute';

select cron.schedule(
  'line-reminders-every-minute',
  '* * * * *',
  $$select public.dispatch_line_reminders();$$
);
