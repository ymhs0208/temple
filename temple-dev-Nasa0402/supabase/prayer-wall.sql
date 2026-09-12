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

create table if not exists public.prayer_wall_reports (
  post_id uuid not null references public.prayer_wall_posts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.prayer_wall_reports enable row level security;

create or replace function public.report_prayer_wall_post(p_post_id uuid, p_user_id uuid)
returns table (report_count integer, moderation_status text, new_report boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted boolean := false;
  v_rows integer;
begin
  if not exists (select 1 from prayer_wall_posts where id = p_post_id) then
    raise exception 'post unavailable';
  end if;
  insert into prayer_wall_reports (post_id, user_id)
  values (p_post_id, p_user_id)
  on conflict (post_id, user_id) do nothing;
  get diagnostics v_rows = row_count;
  v_inserted := v_rows > 0;

  if v_inserted then
    return query
    update prayer_wall_posts
    set report_count = prayer_wall_posts.report_count + 1,
        moderation_status = case when prayer_wall_posts.report_count + 1 >= 3 then 'hidden' else prayer_wall_posts.moderation_status end
    where id = p_post_id
    returning prayer_wall_posts.report_count, prayer_wall_posts.moderation_status, true;
    if found then return; end if;
  else
    return query
    select post.report_count, post.moderation_status, false
    from prayer_wall_posts post
    where post.id = p_post_id;
    if found then return; end if;
  end if;
  raise exception 'post unavailable';
end;
$$;
revoke all on function public.report_prayer_wall_post(uuid, uuid) from public;
grant execute on function public.report_prayer_wall_post(uuid, uuid) to service_role;
