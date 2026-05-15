-- =========================
-- RICH BIZNESS MOBILE
-- 09_sports.sql
-- Sports / Picks / Brackets
-- =========================

create table if not exists public.sports_profiles (
  id uuid primary key default gen_random_uuid(),

  user_id uuid references public.profiles(id) on delete cascade,

  favorite_team text,
  favorite_sport text,

  fan_tag text,
  bio text,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique(user_id)
);

create table if not exists public.sports_posts (
  id uuid primary key default gen_random_uuid(),

  user_id uuid references public.profiles(id) on delete cascade,

  title text,
  description text,

  media_url text,
  thumbnail_url text,

  sport_name text,
  team_name text,

  views_count integer default 0,
  likes_count integer default 0,

  metadata jsonb default '{}'::jsonb,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.sports_picks (
  id uuid primary key default gen_random_uuid(),

  user_id uuid references public.profiles(id) on delete cascade,

  title text not null,

  sport text,
  team_name text,
  opponent text,

  prediction text,
  confidence integer default 0,

  result text default 'pending',

  points integer default 0,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.sports_brackets (
  id uuid primary key default gen_random_uuid(),

  user_id uuid references public.profiles(id) on delete cascade,

  title text not null,

  sport text,

  bracket_data jsonb default '{}'::jsonb,

  status text default 'active',

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.sports_broadcasts (
  id uuid primary key default gen_random_uuid(),

  creator_id uuid references public.profiles(id) on delete cascade,

  title text not null,
  description text,

  stream_url text,

  sport text,

  is_live boolean default false,
  viewers_count integer default 0,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

drop trigger if exists set_sports_profiles_updated_at
on public.sports_profiles;

create trigger set_sports_profiles_updated_at
before update on public.sports_profiles
for each row
execute procedure public.handle_updated_at();

drop trigger if exists set_sports_posts_updated_at
on public.sports_posts;

create trigger set_sports_posts_updated_at
before update on public.sports_posts
for each row
execute procedure public.handle_updated_at();

drop trigger if exists set_sports_picks_updated_at
on public.sports_picks;

create trigger set_sports_picks_updated_at
before update on public.sports_picks
for each row
execute procedure public.handle_updated_at();

drop trigger if exists set_sports_brackets_updated_at
on public.sports_brackets;

create trigger set_sports_brackets_updated_at
before update on public.sports_brackets
for each row
execute procedure public.handle_updated_at();

drop trigger if exists set_sports_broadcasts_updated_at
on public.sports_broadcasts;

create trigger set_sports_broadcasts_updated_at
before update on public.sports_broadcasts
for each row
execute procedure public.handle_updated_at();

create index if not exists sports_posts_user_idx
on public.sports_posts(user_id);

create index if not exists sports_picks_user_idx
on public.sports_picks(user_id);

create index if not exists sports_brackets_user_idx
on public.sports_brackets(user_id);

create index if not exists sports_broadcasts_creator_idx
on public.sports_broadcasts(creator_id);

create index if not exists sports_broadcasts_live_idx
on public.sports_broadcasts(is_live);
