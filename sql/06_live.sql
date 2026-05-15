-- =========================
-- RICH BIZNESS MOBILE
-- 06_live.sql
-- Live / Watch / Chat / Access
-- =========================

create table if not exists public.live_streams (
  id uuid primary key default gen_random_uuid(),

  creator_id uuid references public.profiles(id) on delete cascade,

  slug text unique not null,
  title text not null,
  description text,

  category text default 'general',

  status text default 'draft',
  access_type text default 'free',
  price_cents integer default 0,
  currency text default 'usd',

  thumbnail_url text,
  cover_url text,
  recording_url text,

  livekit_room_name text unique,

  is_chat_enabled boolean default true,
  is_featured boolean default false,

  viewer_count integer default 0,
  peak_viewers integer default 0,
  total_chat_messages integer default 0,
  total_revenue_cents integer default 0,

  started_at timestamptz,
  ended_at timestamptz,
  last_activity_at timestamptz,

  metadata jsonb default '{}'::jsonb,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.live_chat_messages (
  id uuid primary key default gen_random_uuid(),

  stream_id uuid references public.live_streams(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,

  body text not null,

  created_at timestamptz default now()
);

create table if not exists public.live_view_sessions (
  id uuid primary key default gen_random_uuid(),

  stream_id uuid references public.live_streams(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,

  anon_id text,

  joined_at timestamptz default now(),
  left_at timestamptz,

  device_info jsonb default '{}'::jsonb
);

create table if not exists public.live_stream_purchases (
  id uuid primary key default gen_random_uuid(),

  stream_id uuid references public.live_streams(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,

  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_customer_id text,

  amount_cents integer default 0,
  currency text default 'usd',
  status text default 'pending',

  purchased_at timestamptz,
  refunded_at timestamptz,

  metadata jsonb default '{}'::jsonb,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique(stream_id, user_id)
);

create table if not exists public.live_stream_bans (
  id uuid primary key default gen_random_uuid(),

  stream_id uuid references public.live_streams(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  banned_by uuid references public.profiles(id) on delete set null,

  reason text,

  created_at timestamptz default now(),

  unique(stream_id, user_id)
);

create table if not exists public.live_reactions (
  id uuid primary key default gen_random_uuid(),

  stream_id uuid references public.live_streams(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,

  reaction text not null,

  created_at timestamptz default now()
);

drop trigger if exists set_live_streams_updated_at on public.live_streams;
create trigger set_live_streams_updated_at
before update on public.live_streams
for each row
execute procedure public.handle_updated_at();

drop trigger if exists set_live_stream_purchases_updated_at on public.live_stream_purchases;
create trigger set_live_stream_purchases_updated_at
before update on public.live_stream_purchases
for each row
execute procedure public.handle_updated_at();

create index if not exists live_streams_creator_idx on public.live_streams(creator_id);
create index if not exists live_streams_status_idx on public.live_streams(status);
create index if not exists live_streams_slug_idx on public.live_streams(slug);

create index if not exists live_chat_stream_idx on public.live_chat_messages(stream_id);
create index if not exists live_view_stream_idx on public.live_view_sessions(stream_id);
create index if not exists live_purchases_stream_idx on public.live_stream_purchases(stream_id);
create index if not exists live_bans_stream_idx on public.live_stream_bans(stream_id);
create index if not exists live_reactions_stream_idx on public.live_reactions(stream_id);
