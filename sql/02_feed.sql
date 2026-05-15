-- =========================
-- RICH BIZNESS MOBILE
-- 02_feed.sql
-- Feed / Social Core
-- =========================

create table if not exists public.feed_posts (
  id uuid primary key default gen_random_uuid(),

  user_id uuid references public.profiles(id) on delete cascade,

  content text,
  caption text,

  media_url text,
  media_type text default 'text',
  thumbnail_url text,

  section text default 'feed',
  visibility text default 'public',

  likes_count integer default 0,
  comments_count integer default 0,
  reposts_count integer default 0,
  views_count integer default 0,

  metadata jsonb default '{}'::jsonb,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.feed_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.feed_posts(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(post_id, user_id)
);

create table if not exists public.feed_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.feed_posts(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.feed_reposts (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.feed_posts(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  caption text,
  created_at timestamptz default now(),
  unique(post_id, user_id)
);

drop trigger if exists set_feed_posts_updated_at on public.feed_posts;
create trigger set_feed_posts_updated_at
before update on public.feed_posts
for each row
execute procedure public.handle_updated_at();

drop trigger if exists set_feed_comments_updated_at on public.feed_comments;
create trigger set_feed_comments_updated_at
before update on public.feed_comments
for each row
execute procedure public.handle_updated_at();

create index if not exists feed_posts_user_idx on public.feed_posts(user_id);
create index if not exists feed_posts_created_idx on public.feed_posts(created_at desc);
create index if not exists feed_posts_section_idx on public.feed_posts(section);
create index if not exists feed_likes_post_idx on public.feed_likes(post_id);
create index if not exists feed_comments_post_idx on public.feed_comments(post_id);
create index if not exists feed_reposts_post_idx on public.feed_reposts(post_id);
