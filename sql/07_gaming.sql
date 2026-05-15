-- =========================
-- RICH BIZNESS MOBILE
-- 07_gaming.sql
-- Gaming / Arcade / Sessions
-- =========================

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),

  slug text unique not null,
  title text not null,

  description text,

  cover_url text,
  thumbnail_url text,

  genre text,

  is_active boolean default true,
  is_featured boolean default false,

  plays_count integer default 0,

  metadata jsonb default '{}'::jsonb,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.game_sessions (
  id uuid primary key default gen_random_uuid(),

  user_id uuid references public.profiles(id) on delete cascade,
  game_id uuid references public.games(id) on delete cascade,

  duration integer default 0,
  result text,

  score integer default 0,

  metadata jsonb default '{}'::jsonb,

  created_at timestamptz default now()
);

create table if not exists public.game_scores (
  id uuid primary key default gen_random_uuid(),

  user_id uuid references public.profiles(id) on delete cascade,
  game_id uuid references public.games(id) on delete cascade,

  score integer default 0,

  mode text default 'arcade',

  metadata jsonb default '{}'::jsonb,

  created_at timestamptz default now()
);

create table if not exists public.game_clips (
  id uuid primary key default gen_random_uuid(),

  user_id uuid references public.profiles(id) on delete cascade,
  game_id uuid references public.games(id) on delete cascade,

  title text,
  caption text,

  clip_url text not null,
  thumbnail_url text,

  views_count integer default 0,
  likes_count integer default 0,

  metadata jsonb default '{}'::jsonb,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.game_challenges (
  id uuid primary key default gen_random_uuid(),

  challenger_id uuid references public.profiles(id) on delete cascade,
  opponent_id uuid references public.profiles(id) on delete cascade,

  game_id uuid references public.games(id) on delete cascade,

  wager_cents integer default 0,

  status text default 'pending',

  winner_id uuid references public.profiles(id) on delete set null,

  metadata jsonb default '{}'::jsonb,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

drop trigger if exists set_games_updated_at on public.games;
create trigger set_games_updated_at
before update on public.games
for each row
execute procedure public.handle_updated_at();

drop trigger if exists set_game_clips_updated_at on public.game_clips;
create trigger set_game_clips_updated_at
before update on public.game_clips
for each row
execute procedure public.handle_updated_at();

drop trigger if exists set_game_challenges_updated_at on public.game_challenges;
create trigger set_game_challenges_updated_at
before update on public.game_challenges
for each row
execute procedure public.handle_updated_at();

create index if not exists games_slug_idx
on public.games(slug);

create index if not exists game_sessions_user_idx
on public.game_sessions(user_id);

create index if not exists game_scores_game_idx
on public.game_scores(game_id);

create index if not exists game_scores_score_idx
on public.game_scores(score desc);

create index if not exists game_clips_game_idx
on public.game_clips(game_id);

create index if not exists game_challenges_game_idx
on public.game_challenges(game_id);
