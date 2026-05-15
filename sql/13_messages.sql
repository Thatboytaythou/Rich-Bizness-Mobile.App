-- =========================
-- RICH BIZNESS MOBILE
-- 13_messages.sql
-- Messaging / DMs
-- =========================

create table if not exists public.dm_threads (
  id uuid primary key default gen_random_uuid(),

  created_by uuid references public.profiles(id) on delete set null,

  is_group boolean default false,

  title text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.dm_thread_members (
  id uuid primary key default gen_random_uuid(),

  thread_id uuid references public.dm_threads(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,

  joined_at timestamptz default now(),

  unique(thread_id, user_id)
);

create table if not exists public.dm_messages (
  id uuid primary key default gen_random_uuid(),

  thread_id uuid references public.dm_threads(id) on delete cascade,

  sender_id uuid references public.profiles(id) on delete set null,

  body text,

  media_url text,
  media_type text,

  is_edited boolean default false,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.dm_message_reactions (
  id uuid primary key default gen_random_uuid(),

  message_id uuid references public.dm_messages(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,

  reaction text not null,

  created_at timestamptz default now(),

  unique(message_id, user_id, reaction)
);

drop trigger if exists set_dm_threads_updated_at
on public.dm_threads;

create trigger set_dm_threads_updated_at
before update on public.dm_threads
for each row
execute procedure public.handle_updated_at();

drop trigger if exists set_dm_messages_updated_at
on public.dm_messages;

create trigger set_dm_messages_updated_at
before update on public.dm_messages
for each row
execute procedure public.handle_updated_at();

create index if not exists dm_members_thread_idx
on public.dm_thread_members(thread_id);

create index if not exists dm_members_user_idx
on public.dm_thread_members(user_id);

create index if not exists dm_messages_thread_idx
on public.dm_messages(thread_id);

create index if not exists dm_messages_sender_idx
on public.dm_messages(sender_id);

create index if not exists dm_reactions_message_idx
on public.dm_message_reactions(message_id);
