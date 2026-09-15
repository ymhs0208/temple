-- Apply after notification-preferences.sql and automatic-line-reminders.sql.
-- New weekly notifications are opt-in for existing accounts.
alter table public.user_preferences
  add column if not exists morning_enabled boolean not null default true,
  add column if not exists evening_enabled boolean not null default true,
  add column if not exists weekly_enabled boolean not null default false;
-- Weekly uses the evening delivery slot on Sunday, retaining the existing
-- unique(user_id, reminder_kind, scheduled_for) constraint and two-slot limit.
