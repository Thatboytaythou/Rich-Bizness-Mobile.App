-- =========================
-- RICH BIZNESS MOBILE
-- 05_podcast_radio.sql
-- Podcast + Radio System
-- =========================

create table if not exists public.podcast_shows (
  id uuid primary key default gen_random_uuid(),

  creator_id uuid references public.profiles(id) on delete cascade,

  title text not null,
  description text,

  cover_url text,
  category text,

  is_explicit boolean default false,
  is_featured boolean default false,
  is_published boolean default true,

  subscribers_count integer default 0,

  metadata jsonb default '{}'::jsonb,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.podcast_episodes (
  id uuid primary key default gen_random_uuid(),

  show_id uuid references public.podcast_shows(id) on delete cascade,
  creator_id uuid references public.profiles(id) on delete cascade,

  title text not null,
  description text,

  audio_url text not null,
  cover_url text,

  episode_number integer default 1,
  duration_seconds integer default 0,

  plays_count integer default 0,
  likes_count integer default 0,

  is_explicit boolean default false,
  is_featured boolean default false,
  is_published boolean default true,

  metadata jsonb default '{}'::jsonb,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.radio_stations (
  id uuid primary key default gen_random_uuid(),

  creator_id uuid references public.profiles(id) on delete cascade,

  station_name text not null,
  description text,

  cover_url text,
  stream_url text,

  genre text,

  is_live boolean default false,
  is_featured boolean default false,
  is_public boolean default true,

  listeners_count integer default 0,

  metadata jsonb default '{}'::jsonb,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

drop trigger if exists set_podcast_shows_updated_at on public.podcast_shows;
create trigger set_podcast_shows_updated_at
before update on public.podcast_shows
for each row
execute procedure public.handle_updated_at();

drop trigger if exists set_podcast_episodes_updated_at on public.podcast_episodes;
create trigger set_podcast_episodes_updated_at
before update on public.podcast_episodes
for each row
execute procedure public.handle_updated_at();

drop trigger if exists set_radio_stations_updated_at on public.radio_stations;
create trigger set_radio_stations_updated_at
before update on public.radio_stations
for each row
execute procedure public.handle_updated_at();

create index if not exists podcast_shows_creator_idx
on public.podcast_shows(creator_id);

create index if not exists podcast_episodes_show_idx
on public.podcast_episodes(show_id);

create index if not exists podcast_episodes_creator_idx
on public.podcast_episodes(creator_id);

create index if not exists radio_stations_creator_idx
on public.radio_stations(creator_id);

create index if not exists radio_stations_live_idx
on public.radio_stations(is_live);
