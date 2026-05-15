-- =========================
-- RICH BIZNESS MOBILE
-- 08_chess.sql
-- Rich Chess System
-- =========================

create table if not exists public.chess_matches (
  id uuid primary key default gen_random_uuid(),

  white_player_id uuid references public.profiles(id) on delete cascade,
  black_player_id uuid references public.profiles(id) on delete cascade,

  winner_id uuid references public.profiles(id) on delete set null,

  status text default 'waiting',

  current_fen text,
  moves jsonb default '[]'::jsonb,

  time_control text default '10min',

  wager_cents integer default 0,

  started_at timestamptz,
  ended_at timestamptz,

  metadata jsonb default '{}'::jsonb,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.chess_moves (
  id uuid primary key default gen_random_uuid(),

  match_id uuid references public.chess_matches(id) on delete cascade,

  player_id uuid references public.profiles(id) on delete cascade,

  move text not null,
  fen text,

  move_number integer default 1,

  created_at timestamptz default now()
);

create table if not exists public.chess_rankings (
  id uuid primary key default gen_random_uuid(),

  user_id uuid references public.profiles(id) on delete cascade,

  elo integer default 1200,

  wins integer default 0,
  losses integer default 0,
  draws integer default 0,

  games_played integer default 0,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique(user_id)
);

drop trigger if exists set_chess_matches_updated_at
on public.chess_matches;

create trigger set_chess_matches_updated_at
before update on public.chess_matches
for each row
execute procedure public.handle_updated_at();

drop trigger if exists set_chess_rankings_updated_at
on public.chess_rankings;

create trigger set_chess_rankings_updated_at
before update on public.chess_rankings
for each row
execute procedure public.handle_updated_at();

create index if not exists chess_matches_status_idx
on public.chess_matches(status);

create index if not exists chess_moves_match_idx
on public.chess_moves(match_id);

create index if not exists chess_rankings_elo_idx
on public.chess_rankings(elo desc);
