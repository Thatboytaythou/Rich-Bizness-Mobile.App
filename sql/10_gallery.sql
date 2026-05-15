-- =========================
-- RICH BIZNESS MOBILE
-- 10_gallery.sql
-- Gallery / Artwork System
-- =========================

create table if not exists public.artworks (
  id uuid primary key default gen_random_uuid(),

  creator_id uuid references public.profiles(id) on delete cascade,

  title text not null,
  description text,

  artwork_url text not null,
  thumbnail_url text,

  category text,
  medium text,

  price_cents integer default 0,
  currency text default 'usd',

  is_public boolean default true,
  is_featured boolean default false,
  is_for_sale boolean default false,

  views_count integer default 0,
  likes_count integer default 0,

  metadata jsonb default '{}'::jsonb,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.artwork_likes (
  id uuid primary key default gen_random_uuid(),

  artwork_id uuid references public.artworks(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,

  created_at timestamptz default now(),

  unique(artwork_id, user_id)
);

create table if not exists public.artwork_comments (
  id uuid primary key default gen_random_uuid(),

  artwork_id uuid references public.artworks(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,

  body text not null,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.artwork_purchases (
  id uuid primary key default gen_random_uuid(),

  artwork_id uuid references public.artworks(id) on delete cascade,
  buyer_id uuid references public.profiles(id) on delete cascade,

  stripe_payment_intent_id text,
  stripe_checkout_session_id text,

  amount_cents integer default 0,
  currency text default 'usd',

  status text default 'pending',

  purchased_at timestamptz,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

drop trigger if exists set_artworks_updated_at
on public.artworks;

create trigger set_artworks_updated_at
before update on public.artworks
for each row
execute procedure public.handle_updated_at();

drop trigger if exists set_artwork_comments_updated_at
on public.artwork_comments;

create trigger set_artwork_comments_updated_at
before update on public.artwork_comments
for each row
execute procedure public.handle_updated_at();

drop trigger if exists set_artwork_purchases_updated_at
on public.artwork_purchases;

create trigger set_artwork_purchases_updated_at
before update on public.artwork_purchases
for each row
execute procedure public.handle_updated_at();

create index if not exists artworks_creator_idx
on public.artworks(creator_id);

create index if not exists artworks_created_idx
on public.artworks(created_at desc);

create index if not exists artwork_likes_artwork_idx
on public.artwork_likes(artwork_id);

create index if not exists artwork_comments_artwork_idx
on public.artwork_comments(artwork_id);

create index if not exists artwork_purchases_artwork_idx
on public.artwork_purchases(artwork_id);
