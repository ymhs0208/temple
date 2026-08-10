create table if not exists public.prayer_wall_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  display_name text not null,
  message text not null check (char_length(message) between 2 and 120),
  is_anonymous boolean not null default true,
  moderation_status text not null default 'published' check (moderation_status in ('published','pending','hidden')),
  report_count integer not null default 0 check (report_count >= 0),
  created_at timestamptz not null default now()
);
create index if not exists prayer_wall_posts_visible_idx on public.prayer_wall_posts (moderation_status, created_at desc);
alter table public.prayer_wall_posts enable row level security;
