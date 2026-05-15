-- =========================
-- RICH BIZNESS MOBILE
-- 11_store.sql
-- Store / Products / Orders
-- =========================

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),

  creator_id uuid references public.profiles(id) on delete cascade,

  title text not null,
  description text,

  product_type text default 'physical',

  cover_url text,
  preview_url text,

  digital_file_url text,

  price_cents integer default 0,
  currency text default 'usd',

  inventory_count integer default 0,

  is_public boolean default true,
  is_featured boolean default false,
  is_digital boolean default false,

  sales_count integer default 0,
  views_count integer default 0,

  metadata jsonb default '{}'::jsonb,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.store_orders (
  id uuid primary key default gen_random_uuid(),

  product_id uuid references public.products(id) on delete set null,

  buyer_id uuid references public.profiles(id) on delete set null,
  creator_id uuid references public.profiles(id) on delete set null,

  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_customer_id text,

  amount_total integer default 0,
  currency text default 'usd',

  quantity integer default 1,

  payment_status text default 'pending',
  order_status text default 'processing',

  customer_email text,

  metadata jsonb default '{}'::jsonb,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.user_product_unlocks (
  id uuid primary key default gen_random_uuid(),

  user_id uuid references public.profiles(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,

  unlocked_at timestamptz default now(),

  unique(user_id, product_id)
);

create table if not exists public.store_seller_profiles (
  id uuid primary key default gen_random_uuid(),

  user_id uuid references public.profiles(id) on delete cascade,

  store_name text,
  description text,

  logo_url text,
  banner_url text,

  verified boolean default false,

  total_sales integer default 0,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique(user_id)
);

drop trigger if exists set_products_updated_at
on public.products;

create trigger set_products_updated_at
before update on public.products
for each row
execute procedure public.handle_updated_at();

drop trigger if exists set_store_orders_updated_at
on public.store_orders;

create trigger set_store_orders_updated_at
before update on public.store_orders
for each row
execute procedure public.handle_updated_at();

drop trigger if exists set_store_seller_profiles_updated_at
on public.store_seller_profiles;

create trigger set_store_seller_profiles_updated_at
before update on public.store_seller_profiles
for each row
execute procedure public.handle_updated_at();

create index if not exists products_creator_idx
on public.products(creator_id);

create index if not exists products_featured_idx
on public.products(is_featured);

create index if not exists store_orders_buyer_idx
on public.store_orders(buyer_id);

create index if not exists store_orders_creator_idx
on public.store_orders(creator_id);

create index if not exists unlocks_user_idx
on public.user_product_unlocks(user_id);

create index if not exists seller_profiles_user_idx
on public.store_seller_profiles(user_id);
