-- =========================
-- RICH BIZNESS MOBILE
-- 04_music.sql
-- Music / Tracks / Playlists
-- =========================

create table if not exists public.music_tracks (
  id uuid primary key default gen_random_uuid(),

  creator_id uuid references public.profiles(id) on delete cascade,

  title text not null,
  artist_name text,
  description text,

  genre text,
  mood text,

  audio_url text not null,
  cover_url text,

  duration_seconds integer default 0,

  is_explicit boolean default false,
  is_featured boolean default false,
  is_published boolean default true,

  plays_count integer default 0,
  likes_count integer default 0,
  reposts_count integer default 0,

  metadata jsonb default '{}'::jsonb,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.music_likes (
  id uuid primary key default gen_random_uuid(),

  track_id uuid references public.music_tracks(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,

  created_at timestamptz default now(),

  unique(track_id, user_id)
);

create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),

  creator_id uuid references public.profiles(id) on delete cascade,

  title text not null,
  description text,

  cover_url text,

  is_public boolean default true,
  is_featured boolean default false,

  tracks_count integer default 0,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.playlist_tracks (
  id uuid primary key default gen_random_uuid(),

  playlist_id uuid references public.playlists(id) on delete cascade,
  track_id uuid references public.music_tracks(id) on delete cascade,

  position integer default 0,

  created_at timestamptz default now(),

  unique(playlist_id, track_id)
);

create table if not exists public.artist_channels (
  id uuid primary key default gen_random_uuid(),

  creator_id uuid references public.profiles(id) on delete cascade,

  artist_name text not null,
  bio text,

  banner_url text,
  avatar_url text,

  pinned_track_id uuid references public.music_tracks(id) on delete set null,
  pinned_playlist_id uuid references public.playlists(id) on delete set null,

  subscribers_count integer default 0,
  monthly_listeners integer default 0,

  verified boolean default false,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique(creator_id)
);

drop trigger if exists set_music_tracks_updated_at on public.music_tracks;
create trigger set_music_tracks_updated_at
before update on public.music_tracks
for each row
execute procedure public.handle_updated_at();

drop trigger if exists set_playlists_updated_at on public.playlists;
create trigger set_playlists_updated_at
before update on public.playlists
for each row
execute procedure public.handle_updated_at();

drop trigger if exists set_artist_channels_updated_at on public.artist_channels;
create trigger set_artist_channels_updated_at
before update on public.artist_channels
for each row
execute procedure public.handle_updated_at();

create index if not exists music_tracks_creator_idx on public.music_tracks(creator_id);
create index if not exists music_tracks_created_idx on public.music_tracks(created_at desc);
create index if not exists music_tracks_genre_idx on public.music_tracks(genre);

create index if not exists playlists_creator_idx on public.playlists(creator_id);

create index if not exists playlist_tracks_playlist_idx on public.playlist_tracks(playlist_id);
create index if not exists playlist_tracks_track_idx on public.playlist_tracks(track_id);

create index if not exists artist_channels_creator_idx on public.artist_channels(creator_id);
