-- =========================
-- RICH BIZNESS MOBILE
-- 01_profiles.sql
-- Profiles / Identity Core
-- =========================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,

  username text unique,
  display_name text,
  full_name text,
  bio text,

  avatar_url text,
  banner_url text,

  website_url text,
  instagram_url text,
  youtube_url text,
  tiktok_url text,
  facebook_url text,
  snapchat_url text,

  role text default 'user',
  is_creator boolean default false,
  is_artist boolean default false,
  is_seller boolean default false,
  is_verified boolean default false,

  avatar_style text default 'default',
  meta_avatar_url text,
  favorite_section text,

  followers_count integer default 0,
  following_count integer default 0,
  posts_count integer default 0,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

drop trigger if exists set_profiles_updated_at on public.profiles;

create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute procedure public.handle_updated_at();

create index if not exists profiles_username_idx on public.profiles(username);
create index if not exists profiles_display_name_idx on public.profiles(display_name);
create index if not exists profiles_creator_idx on public.profiles(is_creator);
create index if not exists profiles_artist_idx on public.profiles(is_artist);
create index if not exists profiles_seller_idx on public.profiles(is_seller);
