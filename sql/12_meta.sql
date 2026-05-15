-- =========================
-- RICH BIZNESS MOBILE
-- 12_meta.sql
-- Meta / Avatars / Worlds
-- =========================

create table if not exists public.meta_avatars (
  id uuid primary key default gen_random_uuid(),

  user_id uuid references public.profiles(id) on delete cascade,

  avatar_name text,
  avatar_url text,
  model_url text,

  style text default 'default',

  power_level integer default 1,

  is_active boolean default true,

  metadata jsonb default '{}'::jsonb,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique(user_id)
);

create table if not exists public.meta_worlds (
  id uuid primary key default gen_random_uuid(),

  creator_id uuid references public.profiles(id) on delete cascade,

  title text not null,
  description text,

  world_url text,
  cover_url text,

  theme text default 'rich-bizness',

  is_public boolean default true,
  is_featured boolean default false,

  visits_count integer default 0,

  metadata jsonb default '{}'::jsonb,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.meta_visits (
  id uuid primary key default gen_random_uuid(),

  world_id uuid references public.meta_worlds(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,

  visited_at timestamptz default now(),

  metadata jsonb default '{}'::jsonb
);

drop trigger if exists set_meta_avatars_updated_at on public.meta_avatars;
create trigger set_meta_avatars_updated_at
before update on public.meta_avatars
for each row
execute procedure public.handle_updated_at();

drop trigger if exists set_meta_worlds_updated_at on public.meta_worlds;
create trigger set_meta_worlds_updated_at
before update on public.meta_worlds
for each row
execute procedure public.handle_updated_at();

create index if not exists meta_avatars_user_idx
on public.meta_avatars(user_id);

create index if not exists meta_worlds_creator_idx
on public.meta_worlds(creator_id);

create index if not exists meta_visits_world_idx
on public.meta_visits(world_id);
