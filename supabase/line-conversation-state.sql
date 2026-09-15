-- 若 production 已套用 schema.sql，可單獨執行這份 migration。
create table if not exists public.line_conversation_states (
  line_user_id text primary key references public.users(line_user_id) on delete cascade,
  state text not null default 'idle',
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.line_conversation_states enable row level security;
